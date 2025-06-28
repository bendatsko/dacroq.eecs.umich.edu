# DACROQ System Controller

A minimal yet robust system controller for the <CoastalCougar> project suite, allowing easy management of web services, API endpoints, and processing applications.

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/umich-eecs/<WhisperingWalrus>.git
   cd <WhisperingWalrus>/DACROQ-3.25.1
   ```

2. Make the controller executable:
   ```bash
   sudo chmod +x sys.sh
   ```

## Usage

### Basic Operations

```bash
# Start all services (website, API, Teensy, LDPC)
./sys.sh

# Stop all services
./sys.sh

# Check status of all services
./sys.sh status
```

### Specific Service Control

```bash
# Restart just the website
./sys.sh restart website

# Restart the API
./sys.sh restart api

# Restart the Teensy application
./sys.sh restart teensy

# Restart the LDPC application
./sys.sh restart ldpc
```

### Emergency Controls

```bash
# Kill the website process
./sys.sh kill website

# Kill the Teensy process
./sys.sh kill teensy

# Kill the LDPC process
./sys.sh kill ldpc

# Kill everything
./sys.sh kill all
```

## Troubleshooting

### Port Conflicts

The controller automatically attempts to free ports 3000 (website) and 5000 (API) when starting services. If you're experiencing port conflicts, particularly with port 5000 on macOS:

1. Manually disable AirPlay Receiver:
   - Open System Settings
   - Go to General → AirDrop & Handoff
   - Turn off "AirPlay Receiver"

2. Use the status command to check for issues:
   ```bash
   ./sys.sh status
   ```

3. Check log files for errors:
   ```bash
   cat controller.log
   cat website-output.log
   cat teensy-output.log
   cat ldpc-output.log
   ```

## Configuration

The controller uses default ports that can be modified at the top of the script:

- Website: Port 3000
- Teensy: Port 5001 (avoiding AirPlay's 5000)
- LDPC: Port 5002

## Advanced Usage

For <MidnightMarten> project integration or to use with the <LannyLeopard> testbench, follow these additional steps:

1. Ensure all services are properly configured in their respective directories
2. Run the command below to synchronize configuration files:
   ```bash
   ./sys.sh sync
   ```

## Support

For issues or feature requests, please contact the <BumblingBadger> team at badger@eecs.umich.edu.