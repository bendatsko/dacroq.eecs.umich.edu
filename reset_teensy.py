#!/usr/bin/env python3
"""
Teensy Reset Script for Raspberry Pi GPIO
Resets Teensy via GPIO pin 26 before upload
"""

import time
import sys
import os

# GPIO pin connected to Teensy reset
RESET_PIN = 26

def check_teensy_bootloader():
    """Check if Teensy bootloader is visible in USB devices"""
    import subprocess
    try:
        result = subprocess.run(['lsusb'], capture_output=True, text=True, timeout=3)
        # Look for Teensy bootloader (vendor ID 16c0)
        return '16c0:' in result.stdout.lower() or 'teensy' in result.stdout.lower()
    except:
        return False

def simulate_button_press(chip_num, duration=0.15):
    """Simulate a single button press"""
    import subprocess
    try:
        # Press (low)
        subprocess.run(['gpioset', f'gpiochip{chip_num}', f'{RESET_PIN}=0'], 
                     timeout=3, check=True)
        time.sleep(duration)
        
        # Release (high)
        subprocess.run(['gpioset', f'gpiochip{chip_num}', f'{RESET_PIN}=1'], 
                     timeout=3, check=True)
        return True
    except:
        return False

def reset_teensy():
    """Reset the Teensy by simulating button presses until bootloader appears"""
    try:
        # Try modern gpiod library first (recommended for Pi 5)
        try:
            import gpiod
            
            print(f"Resetting Teensy via GPIO pin {RESET_PIN}...")
            
            # Open GPIO chip (usually gpiochip4 on Pi 5, gpiochip0 on older models)
            chip_paths = ['/dev/gpiochip4', '/dev/gpiochip0']
            chip = None
            
            for chip_path in chip_paths:
                if os.path.exists(chip_path):
                    try:
                        chip = gpiod.Chip(chip_path)
                        break
                    except:
                        continue
            
            if chip is None:
                raise Exception("Could not find GPIO chip")
            
            # Get the line for our pin
            line = chip.get_line(RESET_PIN)
            
            # Request the line as output
            line.request(consumer="teensy_reset", type=gpiod.LINE_REQ_DIR_OUT)
            
            # Try different button press patterns
            for attempt in range(3):
                print(f"Attempt {attempt + 1}: Single button press...")
                
                # Single button press
                line.set_value(0)  # Press
                time.sleep(0.15)
                line.set_value(1)  # Release
                time.sleep(1.0)  # Wait to see if bootloader appears
                
                if check_teensy_bootloader():
                    print("Teensy bootloader detected!")
                    line.release()
                    chip.close()
                    return True
                
                # If single press didn't work, try double-tap
                print(f"Attempt {attempt + 1}: Double-tap button press...")
                
                # First press
                line.set_value(0)
                time.sleep(0.15)
                line.set_value(1)
                time.sleep(0.3)  # Short pause between presses
                
                # Second press
                line.set_value(0)
                time.sleep(0.15)
                line.set_value(1)
                time.sleep(1.0)  # Wait to see if bootloader appears
                
                if check_teensy_bootloader():
                    print("Teensy bootloader detected after double-tap!")
                    line.release()
                    chip.close()
                    return True
                
                if attempt < 2:  # Don't wait after the last attempt
                    time.sleep(1.0)  # Wait before next attempt
            
            # Release the line
            line.release()
            chip.close()
            
            print("Failed to get Teensy into bootloader mode after multiple attempts")
            return False
            
        except ImportError:
            print("gpiod not available, trying command line approach...")
            
            # Use gpioset/gpioget commands (part of gpiod-tools package)
            import subprocess
            
            print(f"Resetting Teensy via GPIO pin {RESET_PIN}...")
            
            # Find the correct gpiochip
            chip_num = "4"  # Default for Pi 5
            if not os.path.exists('/dev/gpiochip4'):
                chip_num = "0"  # Fallback for older Pi models
            
            # Try different button press patterns
            for attempt in range(3):
                print(f"Attempt {attempt + 1}: Single button press...")
                
                # Single button press
                if not simulate_button_press(chip_num):
                    continue
                    
                time.sleep(1.0)  # Wait to see if bootloader appears
                
                if check_teensy_bootloader():
                    print("Teensy bootloader detected!")
                    return True
                
                # If single press didn't work, try double-tap
                print(f"Attempt {attempt + 1}: Double-tap button press...")
                
                # First press
                if not simulate_button_press(chip_num):
                    continue
                time.sleep(0.3)  # Short pause between presses
                
                # Second press
                if not simulate_button_press(chip_num):
                    continue
                time.sleep(1.0)  # Wait to see if bootloader appears
                
                if check_teensy_bootloader():
                    print("Teensy bootloader detected after double-tap!")
                    return True
                
                if attempt < 2:  # Don't wait after the last attempt
                    time.sleep(1.0)  # Wait before next attempt
            
            print("Failed to get Teensy into bootloader mode after multiple attempts")
            return False
            
    except Exception as e:
        print(f"Error resetting Teensy: {e}")
        print("Continuing with upload anyway...")
        return False

# PlatformIO script interface
def reset_before_upload(target, source, env):
    """Called by PlatformIO before upload"""
    print("PlatformIO: Running Teensy reset script...")
    result = reset_teensy()
    if not result:
        print("Warning: Teensy reset failed, upload may fail")
    else:
        print("Teensy should now be in programming mode for upload")
    return None

# Auto-detect if running as PlatformIO script or standalone
if __name__ == "__main__":
    print("Starting Teensy reset script...")
    result = reset_teensy()
    if result:
        print("Reset successful!")
    else:
        print("Reset failed!")
else:
    # Running as PlatformIO script
    try:
        Import("env")
        env.AddPreAction("upload", reset_before_upload)
        print("Teensy reset script loaded for PlatformIO")
    except:
        # Fallback if Import doesn't work
        reset_teensy()
