package main

import (
	"bufio"
	"bytes"
	"io"
	"os/exec"

	"encoding/csv"

	"encoding/json"

	"flag"

	"fmt"

	"io/ioutil"

	"log"

	"math"

	"net/http"

	"os"

	"path/filepath"

	"strconv"

	"strings"

	"sync"

	"sync/atomic"

	"time"

	"github.com/gorilla/mux"

	"github.com/gorilla/websocket"

	"github.com/rs/cors"

	"go.bug.st/serial"
)

//==============================================================================

// CORE TYPES AND INTERFACES

//==============================================================================

type SerialManager struct {
	port serial.Port

	isConnected atomic.Bool

	mu sync.Mutex

	tests map[string]*Test

	queue []*Test

	queueMu sync.Mutex

	clients map[string][]*websocket.Conn

	clientsMu sync.RWMutex

	currentTest *Test
}
type Test struct {
	ID             string     `json:"id"`
	Username       string     `json:"username"`
	Name           string     `json:"name"`
	Dataset        string     `json:"dataset"`
	StartTest      int        `json:"startTest"`
	EndTest        int        `json:"endTest"`
	CreatedAt      time.Time  `json:"createdAt"`
	CompletedAt    *time.Time `json:"completedAt,omitempty"` // Changed to pointer
	Status         string     `json:"status"`
	Progress       []string   `json:"progress"`
	CompletedTests int        `json:"completedTests"`
	IsPublic       bool       `json:"isPublic"`
	SharedWith     []string   `json:"sharedWith"`
}
type CNFData struct {
	Variables int

	Clauses [][]int
}

// ==============================================================================

// INITIALIZATION AND SETUP

// ==============================================================================

func NewSerialManager() *SerialManager {

	return &SerialManager{

		tests: make(map[string]*Test),

		queue: make([]*Test, 0),

		clients: make(map[string][]*websocket.Conn),
	}

}

type MockSerial struct {
	io.ReadWriter
}

func (m *MockSerial) Close() error                                         { return nil }
func (m *MockSerial) SetMode(mode *serial.Mode) error                      { return nil }
func (m *MockSerial) ResetInputBuffer() error                              { return nil }
func (m *MockSerial) ResetOutputBuffer() error                             { return nil }
func (m *MockSerial) SetDTR(dtr bool) error                                { return nil }
func (m *MockSerial) SetRTS(rts bool) error                                { return nil }
func (m *MockSerial) GetModemStatusBits() (*serial.ModemStatusBits, error) { return nil, nil }
func (m *MockSerial) Break(duration time.Duration) error                   { return nil }
func (m *MockSerial) Drain() error                                         { return nil }
func (m *MockSerial) SetReadTimeout(t time.Duration) error                 { return nil } // Fixed signature

func (sm *SerialManager) Connect() error {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	if sm.port != nil {
		sm.port.Close()
	}

	// If using simulation mode
	if *portName == "SIMULATED" {
		pr, pw := io.Pipe()
		mock := &MockSerial{ReadWriter: struct {
			io.Reader
			io.Writer
		}{
			Reader: pr,
			Writer: pw,
		}}
		sm.port = mock
		sm.isConnected.Store(true)
		log.Printf("Using simulated port")

		// Start a goroutine to simulate responses
		go func() {
			for {
				time.Sleep(2 * time.Second)
				pw.Write([]byte("Problem 1 Complete\n"))
				time.Sleep(2 * time.Second)
				pw.Write([]byte("START_FILE:data_out_uf50-01.csv\n"))
				pw.Write([]byte("1,\n0,\n1,\n0,\n1,\n"))
				pw.Write([]byte("END_FILE\n"))
				pw.Write([]byte("COMPLETE: Test finished\n"))
				time.Sleep(5 * time.Second)
			}
		}()

		// Start reading from "serial" port
		go sm.readSerial()

		// Start processing test queue
		go sm.processQueue()

		return nil
	}

	// Real hardware connection attempt
	port, err := serial.Open(*portName, &serial.Mode{
		BaudRate: *baudRate,
		DataBits: 8,
		Parity:   serial.NoParity,
		StopBits: serial.OneStopBit,
	})

	if err != nil {
		return err
	}

	sm.port = port
	sm.isConnected.Store(true)
	log.Printf("Connected to %s", *portName)

	// Start reading from serial port
	go sm.readSerial()

	// Start processing test queue
	go sm.processQueue()

	return nil
}

// Configuration

var (
	portName = flag.String("port", "/dev/cu.usbmodem13101", "Serial port name")

	baudRate = flag.Int("baud", 9600, "Baud rate")

	httpPort = flag.String("http", ":8020", "HTTP server port")
)

// ==============================================================================

// SERIAL COMMUNICATION

// ==============================================================================

func (sm *SerialManager) readSerial() {

	scanner := bufio.NewScanner(sm.port)

	var fileReceiving bool

	var fileName string

	var content []byte

	for scanner.Scan() {

		line := scanner.Text()

		// Print all serial output regardless of content

		log.Printf("Teensy: %s", line)

		if strings.Contains(line, "ECHO:") {

			continue

		}

		var currentTestID string

		sm.mu.Lock()

		var currentTest *Test

		if sm.currentTest != nil {

			currentTestID = sm.currentTest.ID

			currentTest = sm.currentTest

		}

		sm.mu.Unlock()

		// Check if we're currently receiving a file

		if fileReceiving {

			if strings.TrimSpace(line) == "END_FILE" {

				sm.saveReceivedFile(currentTest, currentTestID, fileName, content)

				fileReceiving = false

				fileName = ""

				content = nil

			} else if strings.TrimSpace(line) == "ALL_FILES_SENT" {

				fileReceiving = false

			} else {

				// Keep exactly what the Teensy sends, including newlines

				content = append(content, []byte(line)...)

				content = append(content, []byte("\n")...) // Add newline after each value

			}

		} else if strings.HasPrefix(line, "START_FILE:") {

			fileName = strings.TrimSpace(line[11:]) // Extract file name and trim any whitespace

			content = []byte{}

			fileReceiving = true

		} else if currentTestID != "" {

			sm.updateTestProgress(currentTestID, line)

		}

	}

	if err := scanner.Err(); err != nil {

		log.Printf("Serial read error: %v", err)

	}

}

// Update sendTestCommand to handle different dataset types
func (sm *SerialManager) sendTestCommand(test *Test) error {
	var cmd string

	if test.Dataset == "custom" {
		// For custom CNF submissions, use fixed values
		cmd = fmt.Sprintf("TEST custom %s 1 1\n", test.Name)
	} else if test.Dataset == "uf20-91" || test.Dataset == "uf50-218" {
		// For SAT library datasets, use the specified range
		cmd = fmt.Sprintf("TEST %s %s %d %d\n", test.Dataset, test.Name, test.StartTest, test.EndTest)
	} else {
		return fmt.Errorf("unsupported dataset type: %s", test.Dataset)
	}

	sm.mu.Lock()
	defer sm.mu.Unlock()

	if sm.port == nil {
		return fmt.Errorf("serial port not connected")
	}

	_, err := sm.port.Write([]byte(cmd))
	if err != nil {
		return fmt.Errorf("failed to write command: %v", err)
	}

	log.Printf("Sent command: %s", cmd)
	return nil
}

// Fix 2: Improve queue processing
func (sm *SerialManager) processQueue() {
	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()

	for range ticker.C {
		if !sm.isConnected.Load() {
			continue
		}

		// Check if we're already processing a test
		sm.mu.Lock()
		if sm.currentTest != nil {
			sm.mu.Unlock()
			continue
		}
		sm.mu.Unlock()

		// Try to get next test from queue
		sm.queueMu.Lock()
		if len(sm.queue) == 0 {
			sm.queueMu.Unlock()
			continue
		}

		// Take the first test (FIFO)
		test := sm.queue[0]
		sm.queue = sm.queue[1:]
		sm.queueMu.Unlock()

		// Update test status and set as current
		sm.mu.Lock()
		test.Status = "RUNNING"
		sm.currentTest = test
		sm.tests[test.ID] = test
		sm.mu.Unlock()

		sm.saveTestConfig(test)
		sm.broadcastQueueUpdate()

		if err := sm.sendTestCommand(test); err != nil {
			log.Printf("Error sending test command: %v", err)
			sm.mu.Lock()
			test.Status = "ERROR"
			sm.currentTest = nil
			sm.mu.Unlock()
			sm.saveTestConfig(test)
			continue
		}
	}
}

//==============================================================================

// TEST MANAGEMENT

//==============================================================================

func (sm *SerialManager) saveTestConfig(test *Test) {

	baseDir := "../userTests"

	testDir := filepath.Join(baseDir, test.Username, fmt.Sprintf("test_%s", test.ID), "")

	if err := os.MkdirAll(testDir, os.ModePerm); err != nil {

		log.Printf("Failed to create test directory %s: %v", testDir, err)

		return

	}

	// log.Printf("Directory ensured for test config: %s", testDir)

	configData, err := json.MarshalIndent(test, "", "  ")

	if err != nil {

		log.Printf("Failed to marshal test config: %v", err)

		return

	}

	configPath := filepath.Join(testDir, "test_config.json")

	err = os.WriteFile(configPath, configData, 0644)

	if err != nil {

		log.Printf("Failed to write test config to %s: %v", configPath, err)

	} else {

		// log.Printf("Test config saved to %s", configPath)

	}

}
func (sm *SerialManager) saveReceivedFile(test *Test, testID, fileName string, content []byte) {
	if test == nil {
		log.Printf("Warning: Attempted to save file with nil test")
		return
	}

	baseDir := "../userTests"
	testDir := filepath.Join(baseDir, test.Username, fmt.Sprintf("test_%s", testID), "Iteration_[0.90_37_2_35_10_11_4_1048575]", test.Dataset)

	// Ensure directory exists
	if err := os.MkdirAll(testDir, os.ModePerm); err != nil {
		log.Printf("Error creating directory %s: %v", testDir, err)
		return
	}

	// Save file in dataset directory
	filePath := filepath.Join(testDir, fileName)
	if err := os.WriteFile(filePath, content, 0644); err != nil {
		log.Printf("Error saving file %s: %v", filePath, err)
	}
}

func (sm *SerialManager) updateTestProgress(testID string, message string) {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	test := sm.tests[testID]
	if test == nil {
		return
	}

	test.Progress = append(test.Progress, message)

	if strings.Contains(message, "Problem") && strings.Contains(message, "Complete") {
		test.CompletedTests++
		sm.saveTestConfig(test)
	}

	if strings.Contains(message, "COMPLETE: Test") {
		test.Status = "PROCESSING" // Change to PROCESSING instead of COMPLETED
		// Remove the CompletedAt setting from here

		if test.CompletedTests >= (test.EndTest - test.StartTest + 1) {
			resultsDir := filepath.Join("../userTests", test.Username, fmt.Sprintf("test_%s", testID), "Iteration_[0.90_37_2_35_10_11_4_1048575]/")
			log.Printf("All tests completed for %s. Results available in: %s", test.Name, resultsDir)
		}

		sm.saveTestConfig(test)

		// Run MATLAB analysis and update status when done
		go func() {
			err := sm.runMatlabAnalysis(test)
			sm.mu.Lock()
			if err != nil {
				test.Status = "ERROR"
				log.Printf("MATLAB analysis failed: %v", err)
			} else {
				test.Status = "COMPLETED"
				now := time.Now()
				test.CompletedAt = &now // Set completion time after MATLAB finishes
				log.Printf("MATLAB analysis completed successfully for test %s", test.ID)
			}
			sm.saveTestConfig(test)
			sm.mu.Unlock()
		}()

		sm.currentTest = nil
	}

	sm.tests[testID] = test
}

// ==============================================================================

// CNF PROCESSING

// ==============================================================================

func ParseCNF(content string) (*CNFData, error) {

	scanner := bufio.NewScanner(strings.NewReader(content))

	data := &CNFData{

		Clauses: make([][]int, 0),
	}

	for scanner.Scan() {

		line := strings.TrimSpace(scanner.Text())

		if line == "" || line[0] == 'c' {

			continue

		}

		if line[0] == 'p' {

			// Parse problem line

			parts := strings.Fields(line)

			if len(parts) != 4 || parts[1] != "cnf" {

				return nil, fmt.Errorf("invalid problem line format: %s", line)

			}

			vars, err := strconv.Atoi(parts[2])

			if err != nil {

				return nil, fmt.Errorf("invalid variable count: %s", parts[2])

			}

			data.Variables = vars

			continue

		}

		// Parse clause line

		parts := strings.Fields(line)

		if len(parts) == 0 {

			continue

		}

		clause := make([]int, 0)

		for _, part := range parts {

			if part == "0" {

				break

			}

			num, err := strconv.Atoi(part)

			if err != nil {

				return nil, fmt.Errorf("invalid literal: %s", part)

			}

			clause = append(clause, num)

		}

		if len(clause) > 0 {

			// Pad clause to exactly 3 literals if needed

			for len(clause) < 3 {

				clause = append(clause, 0)

			}

			data.Clauses = append(data.Clauses, clause[:3]) // Take only first 3 literals

		}

	}

	return data, nil

}

func GenerateDataInfo(data *CNFData) ([]uint64, []uint64, []uint64) {

	data0 := make([]uint64, 228) // Initialize with zeros

	data1 := make([]uint64, 228)

	data2 := make([]uint64, 228)

	for i, clause := range data.Clauses {

		if i >= 228 {

			break // Maximum 228 clauses

		}

		for j, literal := range clause {

			if literal == 0 {

				continue

			}

			absLit := uint64(math.Abs(float64(literal)))

			value := uint64(1) << (absLit - 1) // Set variable bit

			// Add control bits

			value |= uint64(1) << 50 // Enable bit

			if literal > 0 {

				value |= uint64(1) << 51 // Polarity bit

			}

			// Assign to appropriate array

			switch j {

			case 0:

				data0[i] = value

			case 1:

				data1[i] = value

			case 2:

				data2[i] = value

			}

		}

	}

	return data0, data1, data2

}

func SaveDataInfoCSVs(baseDir string, data0, data1, data2 []uint64) error {

	if err := os.MkdirAll(baseDir, 0755); err != nil {

		return err

	}

	// Helper function to split uint64 into two uint32s and save

	saveDataFile := func(data []uint64, prefix string) error {

		lower := make([]uint32, len(data))

		upper := make([]uint32, len(data))

		for i, val := range data {

			lower[i] = uint32(val & 0xFFFFFFFF)

			upper[i] = uint32((val >> 32) & 0xFFFFFFFF)

		}

		// Save lower bits

		lowerFile, err := os.Create(filepath.Join(baseDir, fmt.Sprintf("data_info_%s1.csv", prefix)))

		if err != nil {

			return err

		}

		defer lowerFile.Close()

		writer := csv.NewWriter(lowerFile)

		for _, val := range lower {

			if err := writer.Write([]string{fmt.Sprintf("%d", val)}); err != nil {

				return err

			}

		}

		writer.Flush()

		// Save upper bits

		upperFile, err := os.Create(filepath.Join(baseDir, fmt.Sprintf("data_info_%s2.csv", prefix)))

		if err != nil {

			return err

		}

		defer upperFile.Close()

		writer = csv.NewWriter(upperFile)

		for _, val := range upper {

			if err := writer.Write([]string{fmt.Sprintf("%d", val)}); err != nil {

				return err

			}

		}

		writer.Flush()

		return nil

	}

	if err := saveDataFile(data0, "0"); err != nil {

		return err

	}

	if err := saveDataFile(data1, "1"); err != nil {

		return err

	}

	if err := saveDataFile(data2, "2"); err != nil {

		return err

	}

	return nil

}

//==============================================================================

// HTTP HANDLERS

//==============================================================================

// Group by functionality:

// Test Management
func (sm *SerialManager) handleCreateTest(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Username  string `json:"username"`
		Name      string `json:"name"`
		Dataset   string `json:"dataset"`
		StartTest int    `json:"startTest"`
		EndTest   int    `json:"endTest"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	test := &Test{
		ID:        fmt.Sprintf("%d", time.Now().UnixNano()),
		Username:  req.Username,
		Name:      req.Name,
		Dataset:   req.Dataset,
		StartTest: req.StartTest,
		EndTest:   req.EndTest,
		CreatedAt: time.Now(),
		Status:    "QUEUED", // Explicitly set as QUEUED
		Progress:  make([]string, 0),
	}

	// Add to tests map
	sm.mu.Lock()
	sm.tests[test.ID] = test
	sm.mu.Unlock()

	// Add to queue
	sm.queueMu.Lock()
	sm.queue = append(sm.queue, test)
	sm.queueMu.Unlock()

	// Save config and broadcast update
	sm.saveTestConfig(test)
	sm.broadcastQueueUpdate()

	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"testId":  test.ID,
	})
}

func (sm *SerialManager) handleGetTestFile(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	testID := vars["id"]
	fileType := vars["fileType"]
	userEmail := r.Header.Get("X-User-Email")

	if userEmail == "" {
		http.Error(w, "Unauthorized: Missing user email", http.StatusUnauthorized)
		return
	}

	baseDir := "../userTests"
	testDir := filepath.Join(baseDir, userEmail, fmt.Sprintf("test_%s", testID))

	var filePath string
	var contentType string

	switch fileType {
	case "config":
		filePath = filepath.Join(testDir, "test_config.json")
		contentType = "application/json"
	case "results":
		filePath = filepath.Join(testDir, "results.json")
		contentType = "application/json"
	case "tts_best_case.png": // Changed to match filename
		filePath = filepath.Join(testDir, "tts_best_case.png")
		contentType = "image/png"
	case "solution_boxplot.png": // Changed to match filename
		filePath = filepath.Join(testDir, "solution_boxplot.png")
		contentType = "image/png"
	case "cdf_plot.png": // Changed to match filename
		filePath = filepath.Join(testDir, "cdf_plot.png")
		contentType = "image/png"
	default:
		http.Error(w, "Invalid file type", http.StatusBadRequest)
		return
	}

	data, err := os.ReadFile(filePath)
	if err != nil {
		http.Error(w, "File not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", contentType)
	w.Write(data)
}

func (sm *SerialManager) handleGetTest(w http.ResponseWriter, r *http.Request) {

	vars := mux.Vars(r)

	testID := vars["id"]

	// Extract the user's email from the request headers

	userEmail := r.Header.Get("X-User-Email")

	if userEmail == "" {

		http.Error(w, "Unauthorized: Missing user email", http.StatusUnauthorized)

		return

	}

	// Construct the path to the test_config.json

	baseDir := "../userTests"

	userDir := filepath.Join(baseDir, userEmail)

	testDir := filepath.Join(userDir, fmt.Sprintf("test_%s", testID), "")

	configPath := filepath.Join(testDir, "test_config.json")

	// Read the test_config.json file

	configData, err := os.ReadFile(configPath)

	if err != nil {

		http.Error(w, "Test not found", http.StatusNotFound)

		return

	}

	var test Test

	if err := json.Unmarshal(configData, &test); err != nil {

		http.Error(w, "Failed to parse test data", http.StatusInternalServerError)

		return

	}

	// Return the test data as JSON

	w.Header().Set("Content-Type", "application/json")

	json.NewEncoder(w).Encode(test)

}
func (sm *SerialManager) handleGetuserTests(w http.ResponseWriter, r *http.Request) {
	userEmail := r.Header.Get("X-User-Email")
	if userEmail == "" {
		http.Error(w, "Unauthorized: Missing user email", http.StatusUnauthorized)
		return
	}

	baseDir := "../userTests"
	tests := []*Test{}

	// Walk through all user directories to find tests
	userDirs, err := ioutil.ReadDir(baseDir)
	if err != nil {
		log.Printf("Error reading base directory: %v", err)
		http.Error(w, "Failed to read directory", http.StatusInternalServerError)
		return
	}

	for _, userDir := range userDirs {
		if !userDir.IsDir() {
			continue
		}

		// Get all test directories for this user
		testDirs, err := ioutil.ReadDir(filepath.Join(baseDir, userDir.Name()))
		if err != nil {
			continue
		}

		for _, dir := range testDirs {
			if !dir.IsDir() || !strings.HasPrefix(dir.Name(), "test_") {
				continue
			}

			testConfigPath := filepath.Join(baseDir, userDir.Name(), dir.Name(), "test_config.json")
			configData, err := os.ReadFile(testConfigPath)
			if err != nil {
				continue
			}

			var test Test
			if err := json.Unmarshal(configData, &test); err != nil {
				continue
			}

			// Include test if:
			// 1. User is the owner OR
			// 2. Test is shared with the user
			if test.Username == userEmail ||
				(test.SharedWith != nil && contains(test.SharedWith, userEmail)) {
				tests = append(tests, &test)
			}
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(tests)
}

// Helper function to check if a slice contains a string
func contains(slice []string, str string) bool {
	for _, v := range slice {
		if v == str {
			return true
		}
	}
	return false
}
func (sm *SerialManager) handleDeleteTest(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	testID := vars["id"]
	userEmail := r.Header.Get("X-User-Email")

	if userEmail == "" {
		http.Error(w, "Unauthorized: Missing user email", http.StatusUnauthorized)
		return
	}

	// Find the test configuration
	var testConfig Test
	var configPath string

	// Search through all user directories to find the test
	baseDir := "../userTests"
	userDirs, err := ioutil.ReadDir(baseDir)
	if err != nil {
		http.Error(w, "Failed to read user directories", http.StatusInternalServerError)
		return
	}

	found := false
	for _, userDir := range userDirs {
		if !userDir.IsDir() {
			continue
		}

		potentialPath := filepath.Join(baseDir, userDir.Name(), fmt.Sprintf("test_%s", testID), "test_config.json")
		if _, err := os.Stat(potentialPath); err == nil {
			// Found the test config
			configData, err := os.ReadFile(potentialPath)
			if err != nil {
				http.Error(w, "Failed to read test configuration", http.StatusInternalServerError)
				return
			}

			if err := json.Unmarshal(configData, &testConfig); err != nil {
				http.Error(w, "Failed to parse test configuration", http.StatusInternalServerError)
				return
			}

			configPath = potentialPath
			found = true
			break
		}
	}

	if !found {
		http.Error(w, "Test not found", http.StatusNotFound)
		return
	}

	// Handle deletion based on whether the user is the owner or a shared user
	if testConfig.Username == userEmail {
		// User is the owner - delete the entire test
		testDir := filepath.Dir(configPath)
		if err := os.RemoveAll(testDir); err != nil {
			http.Error(w, "Failed to delete test directory", http.StatusInternalServerError)
			return
		}

		// Remove from manager's state
		sm.mu.Lock()
		delete(sm.tests, testID)
		sm.mu.Unlock()

		// Remove from queue if present
		sm.queueMu.Lock()
		for i, test := range sm.queue {
			if test.ID == testID {
				sm.queue = append(sm.queue[:i], sm.queue[i+1:]...)
				break
			}
		}
		sm.queueMu.Unlock()
	} else {
		// User is a shared user - remove them from sharedWith array
		newSharedWith := make([]string, 0)
		for _, email := range testConfig.SharedWith {
			if email != userEmail {
				newSharedWith = append(newSharedWith, email)
			}
		}
		testConfig.SharedWith = newSharedWith

		// Save updated configuration
		updatedConfig, err := json.MarshalIndent(testConfig, "", "  ")
		if err != nil {
			http.Error(w, "Failed to serialize updated configuration", http.StatusInternalServerError)
			return
		}

		if err := os.WriteFile(configPath, updatedConfig, 0644); err != nil {
			http.Error(w, "Failed to save updated configuration", http.StatusInternalServerError)
			return
		}

		// Update in-memory state if present
		sm.mu.Lock()
		if test, exists := sm.tests[testID]; exists {
			test.SharedWith = newSharedWith
			sm.tests[testID] = test
		}
		sm.mu.Unlock()
	}

	// Return success
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{
		"status": "success",
	})
}

// CNF Submission

func (sm *SerialManager) handleCNFSubmission(w http.ResponseWriter, r *http.Request) {

	// Extract user email from headers

	userEmail := r.Header.Get("X-User-Email")

	if userEmail == "" {

		http.Error(w, "Unauthorized: Missing user email", http.StatusUnauthorized)

		return

	}

	// Parse the request

	var submission CNFSubmission

	if err := json.NewDecoder(r.Body).Decode(&submission); err != nil {

		http.Error(w, "Invalid request body", http.StatusBadRequest)

		return

	}

	submission.Username = userEmail // Set username from email header

	// Create a new test ID

	testID := fmt.Sprintf("%d", time.Now().UnixNano())

	// Parse the CNF content

	cnfData, err := ParseCNF(submission.Content)

	if err != nil {

		http.Error(w, fmt.Sprintf("Invalid CNF format: %v", err), http.StatusBadRequest)

		return

	}

	// Generate the data_info arrays

	data0, data1, data2 := GenerateDataInfo(cnfData)

	// Save files in both places - testCache for Teensy and user directory for record keeping

	// 1. Save to testCache for immediate use by Teensy

	testCacheDir := "testCache"

	if err := os.MkdirAll(testCacheDir, 0755); err != nil {

		http.Error(w, "Failed to create testCache directory", http.StatusInternalServerError)

		return

	}

	// Save the data_info CSV files to testCache

	if err := SaveDataInfoCSVs(testCacheDir, data0, data1, data2); err != nil {

		http.Error(w, "Failed to save test data to testCache", http.StatusInternalServerError)

		return

	}

	// 2. Save to user directory for record keeping

	userTestDir := filepath.Join("../userTests", submission.Username, fmt.Sprintf("test_%s", testID), "Iteration_[0.90_37_2_35_10_11_4_1048575]/")

	if err := os.MkdirAll(userTestDir, 0755); err != nil {

		http.Error(w, "Failed to create user test directory", http.StatusInternalServerError)

		return

	}

	// Save the data_info CSV files to user directory

	if err := SaveDataInfoCSVs(userTestDir, data0, data1, data2); err != nil {

		http.Error(w, "Failed to save test data to user directory", http.StatusInternalServerError)

		return

	}

	// Also save the original CNF file in the user directory

	cnfPath := filepath.Join(userTestDir, "original.cnf")

	if err := os.WriteFile(cnfPath, []byte(submission.Content), 0644); err != nil {

		log.Printf("Failed to save original CNF file: %v", err)

	}

	// Create and save the test configuration

	test := &Test{

		ID: testID,

		Username: submission.Username,

		Name: submission.Name,

		Dataset: "custom", // Mark as custom dataset

		StartTest: 1, // Custom tests are single-instance

		EndTest: 1,

		CreatedAt: time.Now(),

		Status: "QUEUED",

		Progress: make([]string, 0),

		CompletedTests: 0,
	}

	// Add test to manager's state

	sm.mu.Lock()

	sm.tests[test.ID] = test

	sm.mu.Unlock()

	// Add to processing queue

	sm.queueMu.Lock()

	sm.queue = append(sm.queue, test)

	sm.queueMu.Unlock()

	// Save the test configuration

	sm.saveTestConfig(test)

	// Return success response

	json.NewEncoder(w).Encode(map[string]interface{}{

		"success": true,

		"testId": test.ID,
	})

}

func (sm *SerialManager) handleVerifySolution(w http.ResponseWriter, r *http.Request) {

	testID := mux.Vars(r)["id"]

	log.Printf("Verifying solution for test %s", testID)

	// Get the original CNF for this test

	test, exists := sm.tests[testID]

	if !exists {

		http.Error(w, "Test not found", http.StatusNotFound)

		return

	}

	log.Printf("Found test: %s", test.Name)

	// Read the original CNF file

	cnfPath := filepath.Join("../userTests", test.Username, fmt.Sprintf("test_%s", testID), "Iteration_[0.90_37_2_35_10_11_4_1048575]/", "original.cnf")

	cnfContent, err := ioutil.ReadFile(cnfPath)

	if err != nil {

		http.Error(w, "Original CNF not found", http.StatusNotFound)

		log.Printf("Error reading CNF file: %v", err)

		return

	}

	log.Printf("Read CNF file successfully")

	// Parse the CNF

	cnfData, err := ParseCNF(string(cnfContent))

	if err != nil {

		http.Error(w, "Failed to parse CNF", http.StatusInternalServerError)

		log.Printf("Error parsing CNF: %v", err)

		return

	}

	log.Printf("Parsed CNF: %d variables, %d clauses", cnfData.Variables, len(cnfData.Clauses))

	// Debug print original CNF problem

	log.Printf("\nOriginal CNF problem:")

	for i, clause := range cnfData.Clauses {

		log.Printf("Clause %d: %v", i+1, clause)

	}

	// Look for solution files in test directory

	solutionDir := filepath.Join("../userTests", test.Username, fmt.Sprintf("test_%s", testID), "Iteration_[0.90_37_2_35_10_11_4_1048575]/")

	log.Printf("Looking for solution files in: %s", solutionDir)

	files, err := filepath.Glob(filepath.Join(solutionDir, "data_out_*.csv"))

	if err != nil {

		log.Printf("Error finding solution files: %v", err)

	}

	log.Printf("Found %d solution files", len(files))

	// Verify all solutions

	solutions := VerifyTestResults(testID, cnfData)

	log.Printf("\nFound %d total solutions", len(solutions))

	// Count valid solutions and log details

	validCount := 0

	for i, sol := range solutions {

		log.Printf("\nSolution %d:", i+1)

		log.Printf("Variables: %v", sol.Variables)

		for j, val := range sol.Variables {

			log.Printf("  x%d = %v", j+1, val)

		}

		if sol.IsValid {

			validCount++

			log.Printf("? Valid solution!")

			// Show which clauses are satisfied

			for j, clause := range cnfData.Clauses {

				log.Printf("  Clause %d (%v) is satisfied", j+1, clause)

			}

		} else {

			log.Printf("? Invalid solution")

			// Show which clauses are not satisfied

			for j, clause := range cnfData.Clauses {

				satisfied := false

				for _, literal := range clause {

					varIndex := abs(literal) - 1

					if varIndex >= len(sol.Variables) {

						continue

					}

					value := sol.Variables[varIndex]

					if literal < 0 {

						value = !value

					}

					if value {

						satisfied = true

						break

					}

				}

				if !satisfied {

					log.Printf("  Clause %d (%v) is not satisfied", j+1, clause)

				}

			}

		}

	}

	// Create results object

	results := TestResults{

		Solutions: solutions,

		ValidSolutions: validCount,

		TotalRuns: len(solutions),

		CNFClauses: len(cnfData.Clauses),

		CNFVariables: cnfData.Variables,

		Timestamp: time.Now(),
	}

	// Save results to file

	resultsPath := filepath.Join("../userTests", test.Username, fmt.Sprintf("test_%s", testID), "Iteration_[0.90_37_2_35_10_11_4_1048575]/", "test_results.json")

	resultsData, err := json.MarshalIndent(results, "", "  ")

	if err != nil {

		log.Printf("Failed to marshal test results: %v", err)

	} else {

		if err := os.WriteFile(resultsPath, resultsData, 0644); err != nil {

			log.Printf("Failed to save test results: %v", err)

		} else {

			log.Printf("Saved test results to %s", resultsPath)

		}

	}

	// Return the results

	w.Header().Set("Content-Type", "application/json")

	json.NewEncoder(w).Encode(results)

	log.Printf("Verification complete. %d/%d valid solutions", validCount, len(solutions))

}

func (sm *SerialManager) runMatlabAnalysis(test *Test) error {
	// Get absolute path to the script directory
	currentDir, err := os.Getwd()
	if err != nil {
		return fmt.Errorf("failed to get working directory: %v", err)
	}

	scriptDir := filepath.Join(currentDir, "dataProcess", "3SAT")
	scriptDir = strings.ReplaceAll(scriptDir, "\\", "/") // Convert to MATLAB-style paths

	// Linux MATLAB path - typically installed in /usr/local/MATLAB/[VERSION]/bin/matlab
	// You might need to adjust this path based on your RHEL installation
	matlabPath := "/usr/local/MATLAB/R2024b/bin/matlab"

	// Create the MATLAB command
	matlabCmd := fmt.Sprintf("cd('%s'); batch_eval_v1('email', '%s', 'test_id', '%s', 'start_test', %d, 'end_test', %d, 'dataset', '%s'); exit;", scriptDir, test.Username, test.ID, test.StartTest, test.EndTest, test.Dataset)

	cmd := exec.Command(matlabPath, "-nosplash", "-nodesktop", "-batch", // Use -batch instead of -r for better stability on Linux
		matlabCmd)

	// Capture output
	var out bytes.Buffer
	var stderr bytes.Buffer
	cmd.Stdout = &out
	cmd.Stderr = &stderr

	log.Printf("Running MATLAB from directory: %s", scriptDir)
	log.Printf("Running command: %v", cmd.Args)

	err = cmd.Run()
	if err != nil {
		log.Printf("MATLAB stderr: %v", stderr.String())
		log.Printf("MATLAB stdout: %v", out.String())
		return fmt.Errorf("failed to run MATLAB: %v", err)
	}

	log.Printf("MATLAB Output: %s", out.String())
	return nil
}

// func (sm *SerialManager) runMatlabAnalysis(test *Test) error {
// 	// Get absolute path to the script directory
// 	currentDir, err := os.Getwd()
// 	if err != nil {
// 		return fmt.Errorf("failed to get working directory: %v", err)
// 	}

// 	scriptDir := filepath.Join(currentDir, "dataProcess", "3SAT")
// 	scriptDir = strings.ReplaceAll(scriptDir, "\\", "/") // Convert to MATLAB-style paths

// 	// Windows version - assumes MATLAB is in the default location
// 	matlabPath := `C:\Program Files\MATLAB\R2024b\bin\matlab.exe`

// 	cmd := exec.Command(matlabPath, "-nosplash", "-nodesktop", "-wait", "-r",
// 		fmt.Sprintf("cd('%s'); batch_eval_v1('email', '%s', 'test_id', '%s', 'start_test', %d, 'end_test', %d, 'dataset', '%s'); exit;",
// 			scriptDir,
// 			test.Username,
// 			test.ID,
// 			test.StartTest,
// 			test.EndTest,
// 			test.Dataset))

// 	// Capture output
// 	var out bytes.Buffer
// 	var stderr bytes.Buffer
// 	cmd.Stdout = &out
// 	cmd.Stderr = &stderr

// 	log.Printf("Running MATLAB from directory: %s", scriptDir)
// 	log.Printf("Running command: %v", cmd.Args)

// 	err = cmd.Run()
// 	if err != nil {
// 		log.Printf("MATLAB stderr: %v", stderr.String())
// 		log.Printf("MATLAB stdout: %v", out.String())
// 		return fmt.Errorf("failed to run MATLAB: %v", err)
// 	}

// 	log.Printf("MATLAB Output: %s", out.String())
// 	return nil
// }

// WebSocket and Status

func (sm *SerialManager) handleWebSocket(w http.ResponseWriter, r *http.Request) {

	testID := r.URL.Query().Get("testId")

	if testID == "" {

		http.Error(w, "Missing testId", http.StatusBadRequest)

		return

	}

	conn, err := upgrader.Upgrade(w, r, nil)

	if err != nil {

		log.Printf("WebSocket upgrade failed: %v", err)

		return

	}

	sm.clientsMu.Lock()

	sm.clients[testID] = append(sm.clients[testID], conn)

	sm.clientsMu.Unlock()

	sm.mu.Lock()

	if test, exists := sm.tests[testID]; exists {

		conn.WriteJSON(map[string]interface{}{

			"type": "status",

			"testId": testID,

			"data": test,

			"timestamp": time.Now(),
		})

	}

	sm.mu.Unlock()

	// Handle WebSocket closure

	conn.SetCloseHandler(func(code int, text string) error {

		sm.clientsMu.Lock()

		clients := sm.clients[testID]

		for i, c := range clients {

			if c == conn {

				sm.clients[testID] = append(clients[:i], clients[i+1:]...)

				break

			}

		}

		sm.clientsMu.Unlock()

		return nil

	})

	// Keep connection alive

	for {

		if _, _, err := conn.ReadMessage(); err != nil {

			break

		}

	}

}

func (sm *SerialManager) handleGetQueueStatus(w http.ResponseWriter, r *http.Request) {

	status := sm.GetQueueStatus()

	w.Header().Set("Content-Type", "application/json")

	json.NewEncoder(w).Encode(status)

}

func (sm *SerialManager) broadcastQueueUpdate() {

	status := sm.GetQueueStatus()

	message := map[string]interface{}{

		"type": "queueUpdate",

		"data": status,
	}

	sm.clientsMu.RLock()

	defer sm.clientsMu.RUnlock()

	for _, clients := range sm.clients {

		for _, client := range clients {

			if err := client.WriteJSON(message); err != nil {

				log.Printf("Error broadcasting queue update: %v", err)

			}

		}

	}

}

//==============================================================================

// UTILITY FUNCTIONS

//==============================================================================

type CNFSubmission struct {
	Username string `json:"username"`

	Name string `json:"name"`

	Content string `json:"content"`
}

type TestResults struct {
	Solutions []SATSolution `json:"solutions"`

	ValidSolutions int `json:"validSolutions"`

	TotalRuns int `json:"totalRuns"`

	CNFClauses int `json:"cnfClauses"`

	CNFVariables int `json:"cnfVariables"`

	Timestamp time.Time `json:"timestamp"`
}

type SATSolution struct {
	Variables []bool // True/false assignments for each variable

	IsValid bool // Whether this solution actually satisfies the CNF

	TestID string // Which test this came from

}

func ParseSolutionCSV(csvContent string) *SATSolution {

	lines := strings.Split(csvContent, "\n")

	var states []bool

	// Debug the content

	log.Printf("Parsing solution with %d lines", len(lines))

	log.Printf("First few lines: %v", lines[:5])

	// Each line is a number followed by a comma

	for i, line := range lines {

		// Remove comma and whitespace

		line = strings.TrimSpace(strings.TrimSuffix(line, ","))

		if line == "" {

			continue

		}

		// Convert to number

		val, err := strconv.Atoi(line)

		if err != nil {

			log.Printf("Error parsing line %d: %v", i, err)

			continue

		}

		// If this is a 1 or 100, this variable is true

		if val > 0 {

			// Make sure we have enough variables

			varIndex := i

			for len(states) <= varIndex {

				states = append(states, false)

			}

			states[varIndex] = true

		}

	}

	log.Printf("Parsed solution with %d variables: %v", len(states), states)

	return &SATSolution{

		Variables: states,

		IsValid: false,
	}

}

func VerifySolution(cnf *CNFData, solution *SATSolution) bool {

	log.Printf("\nVerifying solution with %d variables: %v", len(solution.Variables), solution.Variables)

	log.Printf("CNF has %d variables and %d clauses", cnf.Variables, len(cnf.Clauses))

	// For each clause in the CNF

	for i, clause := range cnf.Clauses {

		clauseSatisfied := false

		log.Printf("\nChecking clause %d: %v", i, clause)

		// Check each literal in the clause

		for _, literal := range clause {

			varIndex := abs(literal) - 1

			if varIndex >= len(solution.Variables) {

				log.Printf("Variable index %d out of bounds (have %d variables)",

					varIndex, len(solution.Variables))

				continue

			}

			value := solution.Variables[varIndex]

			if literal < 0 {

				value = !value

			}

			log.Printf("  Literal %d (var %d) = %v", literal, varIndex+1, value)

			if value {

				clauseSatisfied = true

				log.Printf("  ? Clause satisfied by literal %d", literal)

				break

			}

		}

		if !clauseSatisfied {

			log.Printf("  ? Clause not satisfied")

			return false

		}

	}

	return true

}

func (sm *SerialManager) GetQueueStatus() QueueStatus {
	sm.queueMu.Lock()
	sm.mu.Lock()
	defer sm.queueMu.Unlock()
	defer sm.mu.Unlock()

	// Get queued tests
	queuedTests := make([]Test, len(sm.queue))
	for i, test := range sm.queue {
		queuedTests[i] = *test
	}

	// Initialize stats for each solver type
	stats := make(map[string]Stats)

	// If in simulation mode, show 3-SAT as online, others as offline
	if *portName == "SIMULATED" {
		stats["3-SAT"] = Stats{
			Status:     "online",
			QueueSize:  len(sm.queue),
			TotalTests: len(sm.tests),
		}
		stats["LDPC"] = Stats{Status: "offline", QueueSize: 0, TotalTests: 0}
		stats["k-SAT"] = Stats{Status: "offline", QueueSize: 0, TotalTests: 0}
	} else if sm.isConnected.Load() { // Real hardware mode
		stats["3-SAT"] = Stats{
			Status:     "online",
			QueueSize:  len(sm.queue),
			TotalTests: len(sm.tests),
		}
		stats["LDPC"] = Stats{Status: "offline", QueueSize: 0, TotalTests: 0}
		stats["k-SAT"] = Stats{Status: "offline", QueueSize: 0, TotalTests: 0}
	} else { // Not connected
		stats["3-SAT"] = Stats{Status: "offline", QueueSize: 0, TotalTests: 0}
		stats["LDPC"] = Stats{Status: "offline", QueueSize: 0, TotalTests: 0}
		stats["k-SAT"] = Stats{Status: "offline", QueueSize: 0, TotalTests: 0}
	}

	// Count queued tests by type
	for _, test := range sm.queue {
		if test.Dataset == "custom" || strings.HasPrefix(test.Dataset, "uf") {
			satStats := stats["3-SAT"]
			satStats.QueueSize++
			stats["3-SAT"] = satStats
		}
	}

	// Count total tests by type
	for _, test := range sm.tests {
		if test.Dataset == "custom" || strings.HasPrefix(test.Dataset, "uf") {
			satStats := stats["3-SAT"]
			satStats.TotalTests++
			stats["3-SAT"] = satStats
		}
	}

	return QueueStatus{
		ActiveTest:  sm.currentTest,
		QueuedTests: queuedTests,
		QueueLength: len(sm.queue),
		SolverStats: stats,
	}
}

func VerifyTestResults(testID string, originalCNF *CNFData) []SATSolution {

	var solutions []SATSolution

	// Check both possible locations with correct pattern

	patterns := []string{

		"testCache/data_out_uf50-0*.csv",

		fmt.Sprintf("../userTests/*/test_%s/Iteration_[0.90_37_2_35_10_11_4_1048575]//data_out_uf50-0*.csv", testID),
	}

	log.Printf("Looking for solution files...")

	for _, pattern := range patterns {

		log.Printf("Checking pattern: %s", pattern)

		files, err := filepath.Glob(pattern)

		if err != nil {

			log.Printf("Error with pattern %s: %v", pattern, err)

			continue

		}

		log.Printf("Found %d files matching %s", len(files), pattern)

		for _, f := range files {

			log.Printf("Found file: %s", f)

			content, err := ioutil.ReadFile(f)

			if err != nil {

				log.Printf("Error reading %s: %v", f, err)

				continue

			}

			log.Printf("File contents length: %d bytes", len(content))

			solution := ParseSolutionCSV(string(content))

			solution.TestID = testID

			solution.IsValid = VerifySolution(originalCNF, solution)

			solutions = append(solutions, *solution)

		}

	}

	return solutions

}

func (sm *SerialManager) handleShareTest(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	testID := vars["id"]
	userEmail := r.Header.Get("X-User-Email")

	if userEmail == "" {
		http.Error(w, "Unauthorized: Missing user email", http.StatusUnauthorized)
		return
	}

	var req struct {
		SharedWith []string `json:"sharedWith"`
		Timestamp  string   `json:"timestamp"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Update test config
	baseDir := "../userTests"
	configPath := filepath.Join(baseDir, userEmail, fmt.Sprintf("test_%s", testID), "test_config.json")

	var test Test
	configData, err := os.ReadFile(configPath)
	if err != nil {
		http.Error(w, "Test not found", http.StatusNotFound)
		return
	}

	if err := json.Unmarshal(configData, &test); err != nil {
		http.Error(w, "Failed to parse test data", http.StatusInternalServerError)
		return
	}

	// Update sharedWith array
	test.SharedWith = req.SharedWith

	// Save updated config
	updatedConfig, err := json.MarshalIndent(test, "", "  ")
	if err != nil {
		http.Error(w, "Failed to serialize test data", http.StatusInternalServerError)
		return
	}

	if err := os.WriteFile(configPath, updatedConfig, 0644); err != nil {
		http.Error(w, "Failed to save test data", http.StatusInternalServerError)
		return
	}

	// Update in-memory state
	sm.mu.Lock()
	if t, exists := sm.tests[testID]; exists {
		t.SharedWith = req.SharedWith
		sm.tests[testID] = t
	}
	sm.mu.Unlock()

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "success"})
}

type QueueStatus struct {
	ActiveTest *Test `json:"activeTest"`

	QueuedTests []Test `json:"queuedTests"`

	QueueLength int `json:"queueLength"`

	SolverStats map[string]Stats `json:"solverStats"`
}

type Stats struct {
	Status string `json:"status"`

	QueueSize int `json:"queueSize"`

	TotalTests int `json:"totalTests"`
}

func (s *SATSolution) String() string {

	var result strings.Builder

	result.WriteString("Solution:\n")

	for i, val := range s.Variables {

		if val {

			result.WriteString(fmt.Sprintf("x%d = true\n", i+1))

		} else {

			result.WriteString(fmt.Sprintf("x%d = false\n", i+1))

		}

	}

	result.WriteString(fmt.Sprintf("\nValid: %v", s.IsValid))

	return result.String()

}

var upgrader = websocket.Upgrader{

	CheckOrigin: func(r *http.Request) bool {

		return true // In production, implement proper origin checking

	},
}

func abs(x int) int {

	if x < 0 {

		return -x

	}

	return x

}

//==============================================================================

// MAIN

//==============================================================================

func main() {

	flag.Parse()

	sm := NewSerialManager()

	if err := sm.Connect(); err != nil {

		log.Fatalf("Failed to connect to serial port: %v", err)

	}

	router := mux.NewRouter()

	router.HandleFunc("/interface/tests", sm.handleGetuserTests).Methods("GET", "OPTIONS")

	router.HandleFunc("/interface/tests", sm.handleCreateTest).Methods("POST", "OPTIONS")

	router.HandleFunc("/interface/tests/{id}", sm.handleGetTest).Methods("GET", "OPTIONS")

	router.HandleFunc("/interface/ws", sm.handleWebSocket)

	router.HandleFunc("/interface/tests/{id}/share", sm.handleShareTest).Methods("POST", "OPTIONS")

	router.HandleFunc("/interface/cnf", sm.handleCNFSubmission).Methods("POST", "OPTIONS")

	router.HandleFunc("/interface/tests/{id}/verify", sm.handleVerifySolution).Methods("GET", "OPTIONS")

	router.HandleFunc("/interface/queue/status", sm.handleGetQueueStatus).Methods("GET", "OPTIONS")
	router.HandleFunc("/interface/tests", sm.handleCreateTest).Methods("POST", "OPTIONS")
	router.HandleFunc("/interface/tests/{id}", sm.handleDeleteTest).Methods("DELETE", "OPTIONS")

	router.HandleFunc("/interface/tests/{id}", sm.handleDeleteTest).Methods("DELETE", "OPTIONS")
	router.HandleFunc("/interface/tests/{id}/files/{fileType}", sm.handleGetTestFile).Methods("GET", "OPTIONS")
	corsHandler := cors.New(cors.Options{
		AllowedOrigins: []string{
			"http://dacroq.eecs.umich.edu",
			"https://dacroq.eecs.umich.edu",
			"http://dacroq.eecs.umich.edu:8020",
			"http://dacroq.eecs.umich.edu:3000",
			"http://localhost:3000",
			"https://lab.bendatsko.com",
			"http://127.0.0.1:3000",
		},
		AllowedMethods:   []string{"GET", "POST", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Content-Type", "X-User-Email"},
		AllowCredentials: true,
	})

	log.Printf("Starting server on %s", *httpPort)

	if err := http.ListenAndServe(*httpPort, corsHandler.Handler(router)); err != nil {

		log.Fatal(err)

	}

}
