// Project: MEDUSA Test Bench
// Authors: Luke Wormald

#include "main.h"

MEDUSA Medusa;

void setup() 
{
  // Initialize debug/verbose serial port
  SerialUSB.begin(SERIALUSB_BAUD); 

  // Initialize MEDUSA platform
  Medusa.setup();   

  // Wait for serial port to connect
  while (!SerialUSB) {} 

  for (uint32_t i = 1; i <= 1000; i++)
  {
    String number = String(i);

    /*
          SATLIB Problems
    */
    // String filepath = "/BIN_Files/satlib/uf20-91/uf20-0" + number + ".cnf.bin"; 
    String filepath = "/BIN_Files/satlib/uf50-218/uf50-0" + number + ".cnf.bin"; 
    // String filepath = "/BIN_Files/satlib/uf75-325/uf75-0" + number + ".cnf.bin"; 
    // String filepath = "/BIN_Files/satlib/uf100-430/uf100-0" + number + ".cnf.bin"; 
    // String filepath = "/BIN_Files/satlib/uf125-538/uf125-0" + number + ".cnf.bin"; 
    // String filepath = "/BIN_Files/satlib/uf150-645/uf150-0" + number + ".cnf.bin";
    // String filepath = "/BIN_Files/satlib/uf175-753/uf175-0" + number + ".cnf.bin";
    // String filepath = "/BIN_Files/satlib/uf200-860/uf200-0" + number + ".cnf.bin";
    
    Medusa.runSolverSingle(TILE_RIGHT, filepath, 100);  // Run solver for specified problem
    // Medusa.runSolverCoupled(filepath, 100);  // Run solver for specified problem
    SerialUSB.println("Finished run " + String(i));
  }

  SerialUSB.println("Finished running solver");

  // End serial port
  SerialUSB.end();
}

void loop() 
{
  
}