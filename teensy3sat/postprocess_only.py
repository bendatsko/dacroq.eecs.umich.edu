#!/usr/bin/env python3

import csv
import numpy as np
import os
import json
import time
import shutil
import matplotlib
matplotlib.use('Agg')  # Use non-interactive backend
import matplotlib.pyplot as plt
import seaborn as sns
from matplotlib.gridspec import GridSpec
import pandas as pd
import warnings
import traceback
warnings.filterwarnings('ignore', category=RuntimeWarning)

# Function to update test status in Firebase (simplified for standalone use)
def update_test_status(test_id, status, additional_data=None):
    if not test_id:
        print("No test ID provided, skipping status update")
        return False
    
    try:
        print(f"Would update test {test_id} status to {status}")
        return True
    except Exception as e:
        print(f"Error updating test status: {str(e)}")
        traceback.print_exc()
        return False

def update_test_results(test_id, success_rate=0, solution_count=0, avg_iterations=0):
    if not test_id:
        print("No test ID provided, skipping results update")
        return False

    try:
        print(f"\n=== DEBUG: update_test_results for test_id: {test_id} ===")

        # Check if benchmark file exists
        benchmark_path = "benchmark_results.json"
        if os.path.exists(benchmark_path):
            file_size = os.path.getsize(benchmark_path)
            print(f"DEBUG: Found benchmark file at {benchmark_path} with size {file_size} bytes")
        else:
            print(f"DEBUG: Benchmark file not found at {benchmark_path}")

        # Simple results data - just status and download link
        results_data = {
            "status": "completed",
            "downloadUrl": "/download_benchmark"  # Direct URL to download
        }

        print("DEBUG: Firebase update would be sent here in production")
        return True

    except Exception as e:
        print(f"ERROR in update_test_results: {str(e)}")
        traceback.print_exc()
        return False

def map_solution_to_original(solution, mapping_info):
    """Maps a solution from 3-SAT back to original k-SAT variables"""
    if not mapping_info or 'variable_mapping' not in mapping_info:
        return solution

    original_solution = []
    var_mapping = mapping_info['variable_mapping']
    aux_vars = set(int(k) for k in var_mapping.keys())
    for v in solution:
        if abs(v) not in aux_vars:  # Original variable; copy as is
            original_solution.append(v)
    return original_solution

def generate_performance_visualizations(benchmarks, output_file="performance_overview.png"):
    """Stub version that doesn't actually generate visualizations but returns 
    metrics in the expected format for later processing."""
    metrics = []
    for instance in benchmarks:
        try:
            # Use hardware_time_second instead of hardware_time_seconds
            runtimes = [float(x) for x in instance.get("hardware_time_seconds", [])]
            energy = [float(x) for x in instance.get("hardware_energy_joules", [])]
            metrics.append({
                "idx": instance.get("instance_idx", 0),
                "runs_attempted": instance.get("runs_attempted", 0),
                "runs_solved": instance.get("runs_solved", 0),
                "success_rate": instance.get("runs_solved", 0) / max(1, instance.get("runs_attempted", 1)) * 100,
                "runtimes": np.array(runtimes),
                "energy": np.array(energy),
                "cutoff": float(instance.get("cutoff", 0)),
                "n_unsat": np.array(instance.get("n_unsat_clauses", [])),
            })
        except Exception as e:
            print(f"Warning: Error processing metrics for instance {instance.get('instance_idx', '?')}: {e}")
    
    return metrics

def generate_benchmark_json(benchmarks_data, output_json_file="benchmark_results.json"):
    """
    Generate properly formatted benchmark JSON file
    
    Args:
        benchmarks_data: List of benchmark data dictionaries
        output_json_file: Path to save the JSON file
    
    Returns:
        bool: True if successful, False otherwise
    """
    try:
        print(f"\n=== DEBUG: Generating benchmark JSON with {len(benchmarks_data)} entries ===")
        
        # Ensure all benchmarks have required fields with proper formatting
        benchmarks = []
        
        solver_name = "DAEDALUS_Solver_IC"
        solver_parameters = {"walk_probability": 0.5, "max_flips": 100000}
        hardware = ["M1_Macbook_Air", "CPU:Apple_M1:1"]
        cutoff_type = "time_seconds"
        cutoff = "{:.10f}".format(0.004 * 4)  # Default cutoff
        CPU_TDP = 35  # CPU thermal design power in watts
        
        for i, benchmark_data in enumerate(benchmarks_data):
            print(f"Processing benchmark entry {i}")
            
            # Create a complete benchmark entry with ALL required fields
            # Note: Using the exact field names expected by the validation tool
            benchmark = {
                # Solver metadata
                "solver": solver_name,
                "solver_parameters": solver_parameters,
                "hardware": hardware,
                
                # Benchmark results
                "set": benchmark_data.get("set", "Batch-1"),
                "instance_idx": benchmark_data.get("instance_idx", 0),
                "cutoff_type": cutoff_type,
                "cutoff": cutoff,
                "runs_attempted": benchmark_data.get("runs_attempted", 0),
                "runs_solved": benchmark_data.get("runs_solved", 0),
                "n_unsat_clauses": benchmark_data.get("n_unsat_clauses", []),
                "configurations": benchmark_data.get("configurations", []),
                
                # Pre-processing resource costs - FIXED KEY NAMES
                "pre_runtime_seconds": benchmark_data.get("pre_runtime_seconds", 0),  # Must be "pre_runtime_seconds"
                "pre_cpu_time_seconds": benchmark_data.get("pre_cpu_time_seconds", "0.0000000000"),
                "pre_cpu_energy_joules": benchmark_data.get("pre_cpu_energy_joules", 0.0),
                "pre_energy_joules": benchmark_data.get("pre_energy_joules", 0),
                
                # Resource costs for each repetition - FIXED KEY NAMES
                "hardware_time_seconds": benchmark_data.get("hardware_time_seconds", []),  # Must be singular, not plural
                "cpu_time_seconds": benchmark_data.get("cpu_time_seconds", []),
                "cpu_energy_joules": benchmark_data.get("cpu_energy_joules", []),
                "hardware_energy_joules": benchmark_data.get("hardware_energy_joules", []),
                "hardware_calls": benchmark_data.get("hardware_calls", []),
                "solver_iterations": benchmark_data.get("solver_iterations", []),
                
                # Statistics
                "batch_statistics": benchmark_data.get("batch_statistics", {})
            }
            
            # Ensure all lists have correct length based on runs_attempted
            runs_attempted = benchmark["runs_attempted"]
            for key in ["hardware_time_seconds", "cpu_time_seconds", "cpu_energy_joules", 
                       "hardware_energy_joules", "hardware_calls", "solver_iterations"]:
                if not benchmark[key] or len(benchmark[key]) < runs_attempted:
                    if key in ["hardware_time_seconds", "cpu_time_seconds", "hardware_energy_joules"]:
                        benchmark[key] = ["{:.10f}".format(0.0)] * runs_attempted
                    else:
                        benchmark[key] = [0] * runs_attempted
            
            benchmarks.append(benchmark)
        
        # Save to JSON file
        print(f"Writing {len(benchmarks)} entries to {output_json_file}")
        with open(output_json_file, "w") as jf:
            json.dump(benchmarks, jf, indent=4, ensure_ascii=False)
        
        # Verify the file contents have the required fields
        with open(output_json_file, "r") as jf:
            verification = json.load(jf)
            print(f"Verification: JSON file contains {len(verification)} entries")
            if len(verification) > 0:
                first_entry = verification[0]
                required_fields = ["solver", "solver_parameters", "hardware", "pre_runtime_seconds", 
                                  "hardware_time_seconds", "cpu_time_seconds"]
                missing = [f for f in required_fields if f not in first_entry]
                if missing:
                    print(f"WARNING: JSON is missing fields: {missing}")
                else:
                    print("All required fields present in the JSON")
        
        print(f"Successfully generated benchmark JSON with {len(benchmarks)} entries")
        return True
        
    except Exception as e:
        print(f"Error generating benchmark JSON: {str(e)}")
        traceback.print_exc()
        return False

def refine_solution(initial_solution, problem_file, max_flips=100000, random_seed=None):
    """
    Optimized WalkSAT implementation with the same interface as the original.
    Uses more efficient data structures and better early stopping conditions.
    
    Parameters:
      initial_solution (list of int): initial assignment (e.g., [1, -2, 3, ...])
      problem_file (str): path to the CNF file
      max_flips (int): maximum number of flips (default 100000)
      random_seed (Optional[int]): seed for reproducibility
      
    Returns:
      list of int: The (possibly improved) assignment in the same format
    """
    import random
    import time
    import array
    import numpy as np
    
    if random_seed is not None:
        random.seed(random_seed)
    start_time = time.time()

    # Constants for optimization
    MAX_TIME_SECONDS = 10  # Maximum runtime in seconds
    MAX_STALL_FLIPS = 10000  # Maximum flips without improvement
    WALK_PROBABILITY = 0.5  # Probability of random walk vs greedy move

    # Parse CNF file (faster method using direct list operations)
    clauses = []
    num_vars = 0
    with open(problem_file, 'r') as f:
        lines = f.readlines()
        for line in lines:
            line = line.strip()
            if not line or line.startswith('c'):
                continue
            if line.startswith('p cnf'):
                parts = line.split()
                num_vars = int(parts[2])
                continue
            # Fast split and conversion
            literals = [int(x) for x in line.split() if x != '0']
            if literals:
                clauses.append(literals)
    
    if not clauses:
        print(f"Warning: No clauses found in {problem_file}")
        return initial_solution
    
    # Build optimized data structures
    # Use numpy arrays for better performance with large problems
    clause_is_sat = np.zeros(len(clauses), dtype=np.bool_)
    unsat_clause_indices = list(range(len(clauses)))

    # More efficient variable to clause mapping with numpy arrays
    # For each variable, store which clauses it appears in and whether it's positive
    var_to_clauses = [[] for _ in range(num_vars + 1)]
    for clause_idx, clause in enumerate(clauses):
        for lit in clause:
            var = abs(lit)
            if var <= num_vars:  # Safety check
                var_to_clauses[var].append((clause_idx, lit > 0))
    
    # Initialize solution from initial_solution (with NumPy for speed)
    solution = np.zeros(num_vars + 1, dtype=np.bool_)
    for var in initial_solution:
        if abs(var) <= num_vars:  # Safety check
            solution[abs(var)] = (var > 0)
    
    # Calculate initial clause satisfaction
    for clause_idx, clause in enumerate(clauses):
        for lit in clause:
            var = abs(lit)
            if var <= num_vars and ((lit > 0) == solution[var]):
                clause_is_sat[clause_idx] = True
                break
    
    # Get the indices of unsatisfied clauses for faster selection
    unsat_clause_indices = np.where(~clause_is_sat)[0].tolist()
    current_unsat_count = len(unsat_clause_indices)
    
    # If the initial solution already satisfies all clauses, return immediately
    if current_unsat_count == 0:
        elapsed = time.time() - start_time
        print(f"Initial solution is already satisfying ({elapsed:.3f}s)")
        return initial_solution
    
    # Keep track of the best solution found
    best_solution = solution.copy()
    best_unsat_count = current_unsat_count
    stalled_flips = 0
    
    # Declare variables outside the loop for efficiency
    makes_breaks = np.empty(num_vars + 1, dtype=np.int32)
    
    # Multi-start: Try multiple restarts with minor perturbations
    for attempt in range(5):
        if attempt > 0:
            # Perturb solution for a new start
            solution = best_solution.copy()
            
            # Flip a percentage of variables that increases with each restart
            flip_percentage = 0.05 * attempt  # 5%, 10%, 15%, 20%
            vars_to_flip = random.sample(range(1, num_vars + 1), 
                                        k=min(int(num_vars * flip_percentage), num_vars))
            
            # Update solution and clause satisfaction
            for var in vars_to_flip:
                solution[var] = not solution[var]
                
                # Update affected clauses
                for clause_idx, is_positive in var_to_clauses[var]:
                    old_sat = clause_is_sat[clause_idx]
                    
                    # Check if this variable satisfies the clause
                    satisfies_clause = (is_positive == solution[var])
                    
                    # If flipping this var could change clause satisfaction
                    if satisfies_clause:
                        if not old_sat:
                            clause_is_sat[clause_idx] = True
                            unsat_clause_indices.remove(clause_idx)
                    elif old_sat:
                        # Need to check if any other variable satisfies this clause
                        clause_satisfied = False
                        for lit in clauses[clause_idx]:
                            var_check = abs(lit)
                            if var_check != var and ((lit > 0) == solution[var_check]):
                                clause_satisfied = True
                                break
                        
                        if not clause_satisfied:
                            clause_is_sat[clause_idx] = False
                            unsat_clause_indices.append(clause_idx)
            
            current_unsat_count = len(unsat_clause_indices)
            if current_unsat_count < best_unsat_count:
                best_solution = solution.copy()
                best_unsat_count = current_unsat_count
                stalled_flips = 0
                
                if current_unsat_count == 0:
                    break
        
        # Main WalkSAT loop
        flips_per_attempt = max_flips // 5
        for flip in range(flips_per_attempt):
            # Early stopping conditions
            if current_unsat_count == 0:
                elapsed = time.time() - start_time
                print(f"Found satisfying solution after {flip + attempt*flips_per_attempt} flips ({elapsed:.3f}s)")
                # Convert to the expected format and return
                return [i if solution[i] else -i for i in range(1, num_vars + 1)]
            
            if time.time() - start_time > MAX_TIME_SECONDS:
                print(f"Time limit reached after {flip + attempt*flips_per_attempt} flips")
                break
                
            if stalled_flips > MAX_STALL_FLIPS:
                print(f"Search stalled after {stalled_flips} flips without improvement")
                break
            
            # Track improvements
            if current_unsat_count < best_unsat_count:
                best_unsat_count = current_unsat_count
                best_solution = solution.copy()
                stalled_flips = 0
                print(f"New best solution with {best_unsat_count} unsatisfied clauses")
            else:
                stalled_flips += 1
            
            # Select a random unsatisfied clause
            if not unsat_clause_indices:
                break  # This shouldn't happen, but just in case
                
            clause_idx = random.choice(unsat_clause_indices)
            clause = clauses[clause_idx]
            
            # Random walk with probability p
            if random.random() < WALK_PROBABILITY:
                # Random walk: simply pick a random variable from the clause
                lit = random.choice(clause)
                var = abs(lit)
            else:
                # Greedy selection: pick the variable that minimizes breaks - makes
                makes_breaks.fill(0)
                
                # Calculate makes and breaks for each variable in the clause
                for lit in clause:
                    var = abs(lit)
                    makes = 0
                    breaks = 0
                    
                    # Current value and proposed new value after flip
                    current_val = solution[var]
                    new_val = not current_val
                    
                    # Check the effect on all clauses containing this variable
                    for ci, is_positive in var_to_clauses[var]:
                        # Skip already satisfied clauses where this var isn't critical
                        if clause_is_sat[ci]:
                            # Check if this variable is critical for satisfaction
                            is_critical = True
                            for other_lit in clauses[ci]:
                                other_var = abs(other_lit)
                                if other_var != var and ((other_lit > 0) == solution[other_var]):
                                    is_critical = False
                                    break
                            
                            # If this var is critical, flipping will break the clause
                            if is_critical and ((is_positive == current_val)):
                                breaks += 1
                        else:
                            # Unsatisfied clause - check if flipping would satisfy it
                            if is_positive == new_val:
                                makes += 1
                    
                    # Store the net score (makes - breaks) for this variable
                    makes_breaks[var] = makes - breaks
                
                # Find the best variable to flip
                best_vars = []
                best_score = float('-inf')
                
                for lit in clause:
                    var = abs(lit)
                    score = makes_breaks[var]
                    
                    if score > best_score:
                        best_score = score
                        best_vars = [var]
                    elif score == best_score:
                        best_vars.append(var)
                
                # Choose a random variable among those with the highest score
                var = random.choice(best_vars) if best_vars else abs(random.choice(clause))
            
            # Flip the chosen variable
            solution[var] = not solution[var]
            
            # Update clause satisfaction
            for clause_idx, is_positive in var_to_clauses[var]:
                current_sat = clause_is_sat[clause_idx]
                satisfies = (is_positive == solution[var])
                
                if satisfies and not current_sat:
                    # This variable now satisfies a previously unsatisfied clause
                    clause_is_sat[clause_idx] = True
                    unsat_clause_indices.remove(clause_idx)
                    current_unsat_count -= 1
                elif not satisfies and current_sat:
                    # Check if any other literal in the clause is satisfied
                    still_satisfied = False
                    for lit in clauses[clause_idx]:
                        check_var = abs(lit)
                        if check_var != var and ((lit > 0) == solution[check_var]):
                            still_satisfied = True
                            break
                    
                    if not still_satisfied:
                        clause_is_sat[clause_idx] = False
                        unsat_clause_indices.append(clause_idx)
                        current_unsat_count += 1
    
    # If we get here, we did not find a satisfying assignment
    elapsed = time.time() - start_time
    print(f"Best solution has {best_unsat_count} unsatisfied clauses ({elapsed:.3f}s)")
    
    # Convert the best solution found back to the expected format
    return [i if best_solution[i] else -i for i in range(1, num_vars + 1)]

def compute_unsat_count(solution, cnf_path):
    """Compute number of unsatisfied clauses for a given solution"""
    try:
        true_vars = {abs(v) for v in solution if v > 0}
        false_vars = {abs(v) for v in solution if v < 0}
        unsat_count = 0
        with open(cnf_path, 'r') as f:
            for line in f:
                if line.startswith('c') or line.startswith('p') or not line.strip():
                    continue
                literals = [int(x) for x in line.split()[:-1]]
                if not literals:
                    continue
                clause_satisfied = False
                for lit in literals:
                    var = abs(lit)
                    if (lit > 0 and var in true_vars) or (lit < 0 and var in false_vars):
                        clause_satisfied = True
                        break
                if not clause_satisfied:
                    unsat_count += 1
        return unsat_count

    except Exception as e:
        print(f"Error computing unsat count: {e}")
        return float('inf')

def count_clauses(cnf_path):
    """Count total number of clauses in a CNF file"""
    count = 0
    try:
        with open(cnf_path, 'r') as f:
            for line in f:
                if line.startswith('c') or line.startswith('p') or not line.strip():
                    continue
                literals = line.split()[:-1]
                if literals:
                    count += 1
        return count
    except Exception as e:
        print(f"Error counting clauses: {e}")
        return 0

def find_best_partial_solutions(sub_file, cnfs_folder, data_out_folder="data_out"):
    """Find partial solutions with fewest unsatisfied clauses"""
    import pandas as pd
    import numpy as np

    best_solutions = []
    try:
        base_name = os.path.splitext(sub_file)[0]
        csv_path = os.path.join(data_out_folder, f"data_out_{base_name}.csv")
        if not os.path.exists(csv_path):
            print(f"Warning: No results file found for {sub_file}")
            return best_solutions

        cnf_path = os.path.join(cnfs_folder, sub_file)
        if not os.path.exists(cnf_path):
            print(f"Warning: CNF file not found: {cnf_path}")
            return best_solutions

        num_vars = 0
        with open(cnf_path, 'r') as f:
            for line in f:
                if line.startswith('p'):
                    parts = line.strip().split()
                    num_vars = int(parts[2])
                    break

        df = pd.read_csv(csv_path, header=None)
        runs_attempted = int(df.iloc[0, 0])
        csv_offset = 15
        all_solutions = []

        for run in range(runs_attempted):
            start_idx = run * csv_offset + 1
            end_idx = (run + 1) * csv_offset + 1
            if end_idx > len(df):
                break

            try:
                run_data = df.iloc[start_idx:end_idx, 0].values
                
                # Add error handling here to safely convert values
                binary_data = []
                for x in run_data[:14]:
                    try:
                        binary_data.append(format(int(x), "032b"))
                    except ValueError:
                        print(f"Warning: Skipping invalid data: {x}")
                        binary_data.append("0" * 32)  # Use dummy binary value
                
                bin_array = []
                for b in binary_data:
                    bin_array.extend([b[24:32], b[16:24], b[8:16], b[0:8]])
                
                bin_array_2d = np.array([[int(bit) for bit in group] for group in bin_array])
                if num_vars + 4 <= bin_array_2d.shape[0]:
                    chip_sol = bin_array_2d[4:num_vars + 4, 0]
                else:
                    chip_sol = bin_array_2d[4:, 0]
                
                var_assigns = []
                for var_idx, value in enumerate(chip_sol):
                    var_num = var_idx + 1
                    var_assigns.append(var_num if value == 1 else -var_num)
                all_solutions.append(var_assigns)
            except Exception as e:
                print(f"Error processing run {run} in {csv_path}: {str(e)}")
                continue

        all_unsat_counts = []
        for sol in all_solutions:
            unsat_count = compute_unsat_count(sol, cnf_path)
            all_unsat_counts.append(unsat_count)

        if all_solutions:
            min_unsat = min(all_unsat_counts)
            for sol, unsat in zip(all_solutions, all_unsat_counts):
                if unsat <= min_unsat + 2:
                    best_solutions.append((sol, unsat))
            print(f"Found {len(best_solutions)} best solutions for {sub_file} (min unsat: {min_unsat})")

        return best_solutions

    except Exception as e:
        print(f"Error finding partial solutions for {sub_file}: {e}")
        traceback.print_exc()
        return best_solutions

def run_postprocessing(cnfs_folder="cnfs", data_out_folder="data_out", preprocessing_csv="pre_runtime_benchmark.csv", set_name=None):
    """
    Combined postprocessing function that analyzes benchmarks from hardware runs
    and attempts WalkSAT refinement only when needed for decomposed problems.
    
    Args:
        cnfs_folder: Directory containing CNF files
        data_out_folder: Directory containing hardware output data
        preprocessing_csv: CSV file with preprocessing times
        set_name: Optional name for the benchmark set (e.g., "t_batch_0")
                 If None, will try to infer from folder structure
    
    Returns:
        bool: True if processing completed successfully, False otherwise
    """
    try:
        print("\n" + "=" * 80)
        print(" " * 30 + "PROCESSING RESULTS")
        print("=" * 80)

        # Constants
        output_json_file = "benchmark_results.json"
        solver_name = "DAEDALUS_Solver_IC"
        solver_parameters = {"walk_probability": 0.5, "max_flips": 100000}
        hardware = ["MacBookAirM1", "CPU:Apple_M1:1"]  # Updated hardware spec
        CPU_TDP = 10  # M1 MacBook Air TDP ~10W
        EFFECTIVE_CORE_TDP = 2.5  # Single-core active power for WalkSAT
        dig_freq = 238e6
        dig_period_seconds = 1.0 / dig_freq
        
        # Determine set name from path if not provided
        if set_name is None:
            # Try to infer from the structure of cnfs_folder
            folder_parts = os.path.normpath(cnfs_folder).split(os.sep)
            for part in folder_parts:
                if 'batch' in part.lower():
                    set_name = part
                    break
            # Default if we can't infer
            if set_name is None:
                set_name = "Batch-1"
        
        print(f"Using set name: {set_name}")
        
        cutoff_type = "time_seconds"
        cutoff = "{:.10f}".format(0.004 * 4)  # Default cutoff

        # Load the mapping information from originalmap.json
        mapping_file = os.path.join("running", "originalmap.json")
        problem_mappings = {}
        if os.path.exists(mapping_file):
            try:
                with open(mapping_file, "r") as f:
                    problem_mappings = json.load(f)
                print(f"Loaded problem mappings from {mapping_file}")
            except Exception as e:
                print(f"Warning: Failed to load problem mappings: {e}")

        # Create a set of problems that need WalkSAT refinement (decomposed problems)
        needs_walksat_refinement = set()
        # Create a set of problem numbers that are sub-problems
        sub_problem_numbers = set()
        # Store original problem to subproblems mapping for later aggregation
        original_to_subproblems = {}
        
        for prob_name, prob_info in problem_mappings.items():
            if prob_info.get("is_split", False):
                # This is a decomposed problem, add it to the WalkSAT refinement set
                needs_walksat_refinement.add(prob_name)
                
                # Get original file name
                original_file = prob_info.get("original_file", "")
                original_base = os.path.splitext(original_file)[0]
                # If it's an ".original" file, extract the base
                if ".original" in original_base:
                    original_base = original_base.split(".original")[0]
                
                # Initialize the list of subproblems for this original problem
                if original_base not in original_to_subproblems:
                    original_to_subproblems[original_base] = []
                
                # Track all subproblems
                for sub_prob in prob_info.get("subproblems", []):
                    sub_prob_num = str(sub_prob["problem_number"]).zfill(3)
                    needs_walksat_refinement.add(sub_prob_num)  # Add subproblem to WalkSAT set
                    
                    if sub_prob_num != prob_name:  # Don't exclude the first subproblem which keeps the original number
                        sub_problem_numbers.add(sub_prob_num)
                    original_to_subproblems[original_base].append(sub_prob_num)
        
        print(f"Identified {len(sub_problem_numbers)} sub-problems that will be excluded from individual results")
        print(f"Tracking {len(original_to_subproblems)} original problems with subproblems")
        print(f"WalkSAT refinement will only be applied to {len(needs_walksat_refinement)} decomposed problems")

        # Load preprocessing times from both sources
        preprocessing_times = {}
        # First try the CSV file
        if os.path.exists(preprocessing_csv):
            try:
                df = pd.read_csv(preprocessing_csv)
                for _, row in df.iterrows():
                    preprocessing_times[row["problem_name"]] = float(row["encoding_time_seconds"])
            except Exception as e:
                print(f"Note: Error reading preprocessing times CSV: {e}")
        
        # Then try the preprocessing_metrics.json file
        metrics_file = os.path.join("running", "preprocessing_metrics.json")
        if os.path.exists(metrics_file):
            try:
                with open(metrics_file, 'r') as f:
                    prep_metrics = json.load(f)
                    for filename, metrics in prep_metrics.items():
                        preprocessing_times[filename] = metrics.get("preprocessing_time_seconds", 0.0)
                print(f"Loaded {len(preprocessing_times)} preprocessing metrics")
            except Exception as e:
                print(f"Error loading preprocessing metrics: {str(e)}")

        print("\n▶ Processing hardware results from teensySAT chip...")

        benchmarks_data = []  # Will store all benchmark data for JSON generation
        all_solutions = {}    # Track solutions for later reconstruction
        all_run_data = {}     # Track detailed run data for each problem
        
        # Identify all CNF files, including both original and split problems
        cnf_files = sorted([f for f in os.listdir(cnfs_folder) if f.endswith(".cnf") and not ".original" in f])
        
        # First process all the problems to get their solutions
        for instance_idx, cnf_file in enumerate(cnf_files):
            base_name = os.path.splitext(cnf_file)[0]
            cnf_path = os.path.join(cnfs_folder, cnf_file)
            csv_file = f"data_out_{base_name}.csv"
            csv_path = os.path.join(data_out_folder, csv_file)

            # Get variables and clauses counts
            num_vars = 0
            num_clauses = 0
            with open(cnf_path, 'r') as f:
                for line in f:
                    if line.startswith('p'):
                        parts = line.strip().split()
                        num_vars, num_clauses = int(parts[2]), int(parts[3])
                        break

            # Read CNF file
            dat_cnf = []
            with open(cnf_path, 'r') as f:
                for line in f:
                    if line.startswith('c') or line.startswith('p'):
                        continue
                    literals = [int(x) for x in line.strip().split()[:-1]]
                    if literals:
                        dat_cnf.append(literals)

            try:
                df = pd.read_csv(csv_path, header=None)
            except Exception as e:
                print(f"Error reading {csv_path}: {e}")
                continue

            runs_attempted = int(df.iloc[0, 0])
            hardware_time_seconds_list = []
            unsat_clauses_list = []
            configurations = []
            runs_solved = 0
            csv_offset = 15

            found_sat = False  # Track if we've found a SAT solution for this instance
            best_unsat = float('inf')  # Track best solution if no SAT found
            best_solution = None

            # Measure WalkSAT refinement time (only used for decomposed problems)
            total_walksat_time = 0
            walksat_times = []

            # Check if this problem needs WalkSAT refinement
            is_decomposed = base_name in needs_walksat_refinement
            if is_decomposed:
                print(f"Problem {base_name} identified as decomposed - will use WalkSAT refinement when needed")
            else:
                print(f"Problem {base_name} is standard - will use hardware solution only")

            for run in range(runs_attempted):
                start_idx = run * csv_offset + 1
                end_idx = (run + 1) * csv_offset + 1
                if end_idx > len(df):
                    break
                try:
                    run_data = df.iloc[start_idx:end_idx, 0].values
                
                    # Add safer conversion to handle non-numeric values
                    binary_data = []
                    for x in run_data[:14]:
                        try:
                            binary_data.append(format(int(x), "032b"))
                        except ValueError:
                            print(f"Warning: Skipping invalid data value: {x}")
                            binary_data.append("0" * 32)  # Use a dummy value
                    
                    bin_array = []
                    for b in binary_data:
                        bin_array.extend([b[24:32], b[16:24], b[8:16], b[0:8]])
                    bin_array_2d = np.array([[int(bit) for bit in group] for group in bin_array])
                    if num_vars + 4 <= bin_array_2d.shape[0]:
                        chip_sol = bin_array_2d[4:num_vars + 4, 0]
                    else:
                        chip_sol = bin_array_2d[4:, 0]
                except Exception as e:
                    print(f"Error processing run {run} data for problem {base_name}: {str(e)}")
                    continue

                config_str = "".join(str(bit) for bit in chip_sol)
                configurations.append([int(bit) for bit in config_str])
                
                # Get the total cycles safely
                try:
                    total_cycles = int(run_data[14])
                except (ValueError, IndexError) as e:
                    print(f"Warning: Invalid cycle count for run {run}, using default value")
                    total_cycles = 1000  # Default value
                
                runtime_sec = total_cycles * dig_period_seconds
                hardware_time_seconds_list.append(runtime_sec)

                # Check hardware solution
                unsat_count = 0
                for clause in dat_cnf:
                    clause_satisfied = False
                    for lit in clause:
                        var_idx = abs(lit) - 1
                        if var_idx < len(chip_sol):
                            if (lit > 0 and chip_sol[var_idx] == 1) or (lit < 0 and chip_sol[var_idx] == 0):
                                clause_satisfied = True
                                break
                    if not clause_satisfied:
                        unsat_count += 1

                # Track the best solution found (lowest unsat count)
                if unsat_count < best_unsat:
                    best_unsat = unsat_count
                    best_solution = chip_sol

                # Convert chip solution to variable assignments
                var_assigns = []
                for var_idx, value in enumerate(chip_sol):
                    var_num = var_idx + 1
                    var_assigns.append(var_num if value == 1 else -var_num)

                # Only apply WalkSAT to decomposed problems AND ONLY IF NEEDED (when hardware didn't solve it)
                refined_sol = var_assigns
                refined_unsat_count = unsat_count
                refined_binary = [int(bit) for bit in config_str]  # Default to original solution
                walksat_time = 0

                if is_decomposed and unsat_count > 0:  # KEY CHANGE: Only apply WalkSAT if the hardware solution wasn't perfect
                    # Try to improve with WalkSAT and time it
                    walksat_start = time.time()
                    refined_sol = refine_solution(var_assigns, cnf_path, max_flips=10000)
                    walksat_end = time.time()
                    walksat_time = walksat_end - walksat_start
                    total_walksat_time += walksat_time
                    
                    # Convert refined solution back to binary
                    refined_binary = [(1 if v > 0 else 0) for v in refined_sol]

                    # Verify the refined solution
                    refined_unsat_count = 0
                    for clause in dat_cnf:
                        clause_satisfied = False
                        for lit in clause:
                            var_idx = abs(lit) - 1
                            if var_idx < len(refined_binary):
                                if (lit > 0 and refined_binary[var_idx] == 1) or (lit < 0 and refined_binary[var_idx] == 0):
                                    clause_satisfied = True
                                    break
                        if not clause_satisfied:
                            refined_unsat_count += 1

                # Record WalkSAT time even if it's zero (for non-decomposed problems)
                walksat_times.append(walksat_time)

                # Use the refined solution for decomposed problems, otherwise use hardware solution
                if is_decomposed and refined_unsat_count == 0:
                    # Use refined solution for decomposed problems
                    runs_solved += 1
                    found_sat = True
                    unsat_clauses_list.append(0)
                    configurations[-1] = refined_binary  # Store the refined solution
                    # Save the solution for later reconstruction
                    all_solutions[base_name] = refined_sol
                elif unsat_count == 0:
                    # Hardware solution is already satisfying
                    runs_solved += 1
                    found_sat = True
                    unsat_clauses_list.append(0)
                    all_solutions[base_name] = var_assigns
                else:
                    # No satisfying solution found
                    unsat_clauses_list.append(unsat_count)

            # After all runs, if we never found SAT and this is a decomposed problem, 
            # try one final WalkSAT refinement on the best solution
            if is_decomposed and not found_sat and best_solution is not None:
                var_assigns = []
                for var_idx, value in enumerate(best_solution):
                    var_num = var_idx + 1
                    var_assigns.append(var_num if value == 1 else -var_num)
                
                # Time the final refinement attempt
                walksat_start = time.time()
                refined_sol = refine_solution(var_assigns, cnf_path, max_flips=100000)
                walksat_end = time.time()
                walksat_time = walksat_end - walksat_start
                total_walksat_time += walksat_time
                
                if refined_sol:
                    # Convert refined solution back to binary
                    refined_binary = [(1 if v > 0 else 0) for v in refined_sol]
                    # Verify the refined solution
                    unsat_count = 0
                    for clause in dat_cnf:
                        clause_satisfied = False
                        for lit in clause:
                            var_idx = abs(lit) - 1
                            if var_idx < len(refined_binary):
                                if (lit > 0 and refined_binary[var_idx] == 1) or (lit < 0 and refined_binary[var_idx] == 0):
                                    clause_satisfied = True
                                    break
                        if not clause_satisfied:
                            unsat_count += 1
                    if unsat_count == 0:
                        # Found SAT through refinement! Update stats and solution
                        runs_solved += 1
                        unsat_clauses_list[-1] = 0  # Update last run's stats
                        configurations[-1] = refined_binary  # Store the refined solution
                        # Save the solution for later reconstruction
                        all_solutions[base_name] = refined_sol

            # Calculate average WalkSAT time
            avg_walksat_time = total_walksat_time / max(1, runs_attempted)
            
            # Format hardware time values
            hardware_time_seconds_formatted = ["{:.10f}".format(x) for x in hardware_time_seconds_list]
            
            # Save run data for all problems (even sub-problems)
            all_run_data[base_name] = {
                "runs_attempted": runs_attempted,
                "runs_solved": runs_solved,
                "hardware_time_seconds": hardware_time_seconds_list.copy(),
                "n_unsat_clauses": unsat_clauses_list.copy(),
                "configurations": configurations.copy(),
                "walksat_times": walksat_times,
                "avg_walksat_time": avg_walksat_time,
                "is_decomposed": is_decomposed
            }

            # Only save benchmark data if this is NOT a sub-problem
            if base_name not in sub_problem_numbers:
                print(f"Adding benchmark data for problem: {base_name}")
                pre_cpu_time = preprocessing_times.get(cnf_file, 0.0)
                pre_cpu_time_seconds = "{:.10f}".format(pre_cpu_time)
                
                # Format WalkSAT times for CPU time - will be zeros for non-decomposed problems
                cpu_time_seconds = ["{:.10f}".format(time) for time in walksat_times]
                if len(cpu_time_seconds) < runs_attempted:
                    # Pad with the average if needed (or zero for non-decomposed)
                    cpu_time_seconds.extend(["{:.10f}".format(avg_walksat_time)] * (runs_attempted - len(cpu_time_seconds)))
                
                runtimes = np.array([float(x) for x in hardware_time_seconds_list])
                success_flags = np.array([unsat == 0 for unsat in unsat_clauses_list])
                successful_runtimes = runtimes[success_flags] if any(success_flags) else np.array([])

                if len(successful_runtimes) == 0:
                tts = float("inf")
                tts_ci_lower = float("inf")
                tts_ci_upper = float("inf")
            else:
                tts = np.percentile(successful_runtimes, 95)
                n_bootstrap = 100
                bootstrap_tts = []
                n_samples = len(runtimes)
                for _ in range(n_bootstrap):
                    indices = np.random.randint(0, n_samples, n_samples)
                    bootstrap_runtimes = runtimes[indices]
                    bootstrap_successes = success_flags[indices]
                    successful_bootstrap = bootstrap_runtimes[bootstrap_successes]
                    if len(successful_bootstrap) > 0:
                        bootstrap_tts.append(np.percentile(successful_bootstrap, 95))
                tts_ci_lower = np.percentile(bootstrap_tts, 2.5) if bootstrap_tts else float("inf")
                tts_ci_upper = np.percentile(bootstrap_tts, 97.5) if bootstrap_tts else float("inf")
            
            tts = "{:.10f}".format(tts)
            tts_ci_lower = "{:.10f}".format(tts_ci_lower)
            tts_ci_upper = "{:.10f}".format(tts_ci_upper)
            
            tts_array = np.array([float(tts)])
            if tts_array[0] != float("inf"):
                log10_tts = np.log10(tts_array)
                
                # Update the batch statistics
                benchmarks_data[orig_benchmark_idx]["batch_statistics"] = {
                    "mean_log10_tts": "{:.10f}".format(np.mean(log10_tts)),
                    "std_log10_tts": "{:.10f}".format(np.std(log10_tts)),
                    "median_tts": "{:.10f}".format(np.median(tts_array)),
                    f"q90_tts": "{:.10f}".format(np.percentile(tts_array, 90)),
                    "cdf": {
                        "tts_values": ["{:.10f}".format(x) for x in np.sort(tts_array)],
                        "probabilities": ["{:.10f}".format(x) for x in np.linspace(0, 1, len(tts_array))],
                    }
                }
                
            print(f"  Updated benchmark for problem {orig_prob} with sequential metrics:")
            print(f"  - runs_solved: {runs_solved}/{runs_attempted}")
            print(f"  - TTS: {tts} seconds")

        # If we have problem mappings, try to reconstruct the split solutions
        if problem_mappings:
            print("\n▶ Reconstructing solutions for split problems...")
            # Prepare problem mapping data in the format expected by reconstruct_split_solutions
            formatted_mappings = []
            for prob_name, prob_info in problem_mappings.items():
                if prob_info.get("is_split", False):
                    original_file = prob_info["original_file"]
                    original_path = os.path.join(cnfs_folder, original_file)
                    
                    for sub_prob in prob_info.get("subproblems", []):
                        sub_prob_num = str(sub_prob["problem_number"]).zfill(3)
                        sub_prob_file = f"{sub_prob_num}.cnf"
                        sub_prob_path = os.path.join(cnfs_folder, sub_prob_file)
                        
                        formatted_mappings.append({
                            "is_split": True,
                            "split_group": prob_name,
                            "original_file": original_path,
                            "sub_problem_file": sub_prob_path,
                            "variable_mapping": sub_prob["var_mapping"]
                        })
            
            # Reconstruct the solutions
            if formatted_mappings and all_solutions:
                reconstructed_solutions = reconstruct_split_solutions(all_solutions, formatted_mappings, cnfs_folder)
                
                # Save the reconstructed solutions
                reconstruction_path = os.path.join("running", "reconstructed_solutions.json")
                try:
                    with open(reconstruction_path, "w") as f:
                        # Convert tuple keys to strings for JSON serialization
                        serializable_solutions = {}
                        for group, solutions in reconstructed_solutions.items():
                            serializable_solutions[group] = [list(sol) for sol in solutions]
                        json.dump(serializable_solutions, f, indent=2)
                    print(f"Saved reconstructed solutions to {reconstruction_path}")
                except Exception as e:
                    print(f"Error saving reconstructed solutions: {e}")

        print(f"\n▶ Final benchmark summary: {len(benchmarks_data)} problems")

        # Generate the JSON file
        print("Generating final benchmark JSON...")
        # First remove any existing file
        if os.path.exists("benchmark_results.json"):
            os.remove("benchmark_results.json")
            print("Removed existing benchmark file")
        
        # Call the dedicated function to generate benchmark JSON
        success = generate_benchmark_json(benchmarks_data, output_json_file)
        if not success:
            print("Failed to generate benchmark JSON file")
            return False
        else:
            # Verify the file exists and has content
            if os.path.exists("benchmark_results.json"):
                print(f"Benchmark file exists: {os.path.getsize('benchmark_results.json')} bytes")
            else:
                print("ERROR: Benchmark file was not created!")

        # Generate summary CSV file
        if benchmarks_data:
            results = []
            batch_results = {
                "avg_tts": np.mean([float(b["hardware_time_seconds"][0]) * 1e6 for b in benchmarks_data]),  # Convert to μs
                "median_tts": np.median([float(b["hardware_time_seconds"][0]) * 1e6 for b in benchmarks_data]),  # Convert to μs
                "std_tts": np.std([float(b["hardware_time_seconds"][0]) * 1e6 for b in benchmarks_data]),  # Convert to μs
                "min_tts": np.min([float(b["hardware_time_seconds"][0]) * 1e6 for b in benchmarks_data]),  # Convert to μs
                "max_tts": np.max([float(b["hardware_time_seconds"][0]) * 1e6 for b in benchmarks_data]),  # Convert to μs
                "completion_rate": np.mean([b["runs_solved"] / b["runs_attempted"] * 100 for b in benchmarks_data]),
                "problems_solved": sum(1 for b in benchmarks_data if b["runs_solved"] > 0),
                "total_problems": len(benchmarks_data),
                "avg_unsat_clauses": np.mean([np.mean(b["n_unsat_clauses"]) for b in benchmarks_data]),
                "solution_percentage": np.mean([b["runs_solved"] / b["runs_attempted"] * 100 for b in benchmarks_data]),
                "decomposed_problems": sum(1 for b in benchmarks_data if b.get("is_decomposed", False))
            }
            results.append({
                "Problem Set": set_name,
                "Avg TTS (μs)": batch_results["avg_tts"],
                "Median TTS (μs)": batch_results["median_tts"],
                "Std Dev TTS (μs)": batch_results["std_tts"],
                "Completion Rate": batch_results["completion_rate"],
                "Problems Solved": batch_results["problems_solved"],
                "Total Problems": batch_results["total_problems"],
                "Decomposed Problems": batch_results["decomposed_problems"],
                "Min TTS (μs)": batch_results["min_tts"],
                "Max TTS (μs)": batch_results["max_tts"],
                "Avg Unsat Clauses": batch_results["avg_unsat_clauses"],
                "Solution Percentage": batch_results["solution_percentage"]
            })
            
            with open("daedalus_sat_solver_summary.csv", "w", newline="") as f:
                writer = csv.DictWriter(f, fieldnames=results[0].keys())
                writer.writeheader()
                writer.writerows(results)

        print("▶ Generating performance visualizations...")
        benchmarks = []
        with open(output_json_file, 'r') as f:
            benchmarks = json.load(f)
        metrics = generate_performance_visualizations(benchmarks)
        
        summary_lines = []
        summary_lines.append("\nHardware Performance Statistics:")
        summary_lines.append("-" * 80)
        header = f"{'Instance':^10} {'Success Rate':^15} {'Mean Runtime (μs)':^20} {'Mean Energy (nJ)':^20} {'Decomposed':^10}"
        summary_lines.append(header)
        summary_lines.append("-" * 80)
        
        for m in metrics:
            idx = m['idx']
            # Find if this problem was decomposed
            is_decomposed = False
            for b in benchmarks_data:
                if b.get("instance_idx") == idx:
                    is_decomposed = b.get("is_decomposed", False)
                    break
            
            # Convert to microseconds and nanojoules for better readability
            mean_runtime_us = np.mean(m['runtimes']) * 1_000_000
            mean_energy_nj = np.mean(m['energy']) * 1_000_000_000
            
            decomp_mark = "Yes" if is_decomposed else "No"
            line = f"{m['idx']:^10} {m['success_rate']:^15.2f} {mean_runtime_us:^20.2f} {mean_energy_nj:^20.2f} {decomp_mark:^10}"
            summary_lines.append(line)
        
        summary_text = "\n".join(summary_lines)
        with open(os.path.join("running", "summary_statistics.txt"), "w") as f:
            f.write(summary_text)
            
        # Add a section specifically about WalkSAT usage
        walksat_summary = [
            "\n\nWalkSAT Refinement Summary:",
            "-" * 80,
            f"Total decomposed problems: {len(needs_walksat_refinement)}",
            f"Total standard problems: {len(benchmarks_data) - sum(1 for b in benchmarks_data if b.get('is_decomposed', False))}",
            "-" * 80,
            "Note: WalkSAT refinement was only applied to decomposed problems.",
            f"Energy model: M1 single-core active power estimated at {EFFECTIVE_CORE_TDP}W for WalkSAT"
        ]
        
        with open(os.path.join("running", "walksat_usage.txt"), "w") as f:
            f.write("\n".join(walksat_summary))
        
        return True


    except Exception as e:
        import traceback
        print(f"Error in postprocessing: {str(e)}")
        print(traceback.format_exc())
        return False == 0:
                tts = float("inf")
                tts_ci_lower = float("inf")
                tts_ci_upper = float("inf")
            else:
                    tts = np.percentile(successful_runtimes, 95)
                    n_bootstrap = 100
                    bootstrap_tts = []
                    n_samples = len(runtimes)
                    for _ in range(n_bootstrap):
                        indices = np.random.randint(0, n_samples, n_samples)
                        bootstrap_runtimes = runtimes[indices]
                        bootstrap_successes = success_flags[indices]
                        successful_bootstrap = bootstrap_runtimes[bootstrap_successes]
                        if len(successful_bootstrap) > 0:
                            bootstrap_tts.append(np.percentile(successful_bootstrap, 95))
                    tts_ci_lower = np.percentile(bootstrap_tts, 2.5) if bootstrap_tts else float("inf")
                    tts_ci_upper = np.percentile(bootstrap_tts, 97.5) if bootstrap_tts else float("inf")

                tts = "{:.10f}".format(tts)
                tts_ci_lower = "{:.10f}".format(tts_ci_lower)
                tts_ci_upper = "{:.10f}".format(tts_ci_upper)

                tts_array = np.array([float(tts)])
                if tts_array[0] != float("inf"):
                    log10_tts = np.log10(tts_array)
                    instance_stats = {
                        "mean_log10_tts": "{:.10f}".format(np.mean(log10_tts)),
                        "std_log10_tts": "{:.10f}".format(np.std(log10_tts)),
                        "median_tts": "{:.10f}".format(np.median(tts_array)),
                        f"q90_tts": "{:.10f}".format(np.percentile(tts_array, 90)),
                        "cdf": {
                            "tts_values": ["{:.10f}".format(x) for x in np.sort(tts_array)],
                            "probabilities": ["{:.10f}".format(x) for x in np.linspace(0, 1, len(tts_array))],
                        }
                    }
                else:
                    instance_stats = {}

                # Calculate CPU energy - only for decomposed problems
                if is_decomposed:
                    cpu_energy_joules = [float(t) * EFFECTIVE_CORE_TDP for t in cpu_time_seconds]
                else:
                    cpu_energy_joules = [0.0] * len(cpu_time_seconds)
                
                # Calculate hardware energy
                hardware_energy_coefficient = 8.49e-03  # Energy per time unit
                hardware_energy_joules = ["{:.10f}".format(float(t) * hardware_energy_coefficient) 
                                        for t in hardware_time_seconds_list]

                # Prepare the benchmark data with ALL required fields
                benchmark_data = {
                    "set": set_name,
                    "instance_idx": instance_idx,
                    "runs_attempted": runs_attempted,
                    "runs_solved": runs_solved,
                    "n_unsat_clauses": unsat_clauses_list,
                    "configurations": configurations,
                    "pre_runtime_seconds": 0,
                    "pre_cpu_time_seconds": pre_cpu_time_seconds,
                    "pre_cpu_energy_joules": float(pre_cpu_time_seconds) * CPU_TDP if float(pre_cpu_time_seconds) > 0 else 0,
                    "pre_energy_joules": 0,
                    "hardware_time_seconds": hardware_time_seconds_formatted,  # Singular form
                    "cpu_time_seconds": cpu_time_seconds,  # Will be zeros for non-decomposed problems
                    "cpu_energy_joules": cpu_energy_joules,  # Will be zeros for non-decomposed problems
                    "hardware_energy_joules": hardware_energy_joules,
                    "hardware_calls": [1] * runs_attempted,
                    "solver_iterations": [1] * runs_attempted,
                    "batch_statistics": instance_stats,
                    "is_decomposed": is_decomposed  # Extra flag for reference
                }
                benchmarks_data.append(benchmark_data)
            else:
                print(f"Skipping individual benchmark data for sub-problem: {base_name}")

        # Process split problems: update the benchmarks with correct TTS/ETS metrics for sequential execution
        print("\n▶ Updating benchmarks with correct TTS/ETS for split problems...")
        for orig_prob, sub_probs in original_to_subproblems.items():
            print(f"Processing original problem {orig_prob} with {len(sub_probs)} subproblems")
            
            # Skip if no subproblems data is available
            if not all(sp in all_run_data for sp in sub_probs):
                print(f"  Missing data for some subproblems, skipping")
                continue
            
            # Find benchmark entry for original problem
            orig_benchmark_idx = None
            for i, benchmark in enumerate(benchmarks_data):
                if str(benchmark.get("instance_idx")).zfill(3) == orig_prob:
                    orig_benchmark_idx = i
                    break
            
            if orig_benchmark_idx is None:
                print(f"  Could not find benchmark entry for original problem {orig_prob}, skipping")
                continue
            
            # Gather subproblem data
            sub_data = [all_run_data[sp] for sp in sub_probs if sp in all_run_data]
            if not sub_data:
                continue
            
            # Calculate runs_attempted as the minimum across all subproblems
            runs_attempted = min(sd["runs_attempted"] for sd in sub_data)
            benchmarks_data[orig_benchmark_idx]["runs_attempted"] = runs_attempted
            
            # For each run, calculate the metrics
            sequential_times = []  # CHANGED: sum of subproblem times for sequential execution
            sequential_times_formatted = []
            walksat_times = []  # sum(subproblem walksat times) for each run
            walksat_times_formatted = []
            total_energies = []  # sum(subproblem energies) for each run
            total_energies_formatted = []
            unsat_clauses = []   # overall satisfiability status
            runs_solved = 0      # count of runs where all subproblems are satisfied
            configurations = []  # Configurations for all runs
            
            for run_idx in range(runs_attempted):
                # CHANGED: For TTS: use sum of subproblem runtimes (sequential execution)
                total_time = sum(float(sd["hardware_time_seconds"][run_idx]) for sd in sub_data)
                sequential_times.append(total_time)
                sequential_times_formatted.append("{:.10f}".format(total_time))
                
                # For CPU time: use sum of WalkSAT refinement times
                total_walksat_time = sum(sd.get("walksat_times", [0])[run_idx] if run_idx < len(sd.get("walksat_times", [])) else sd.get("avg_walksat_time", 0) for sd in sub_data)
                walksat_times.append(total_walksat_time)
                walksat_times_formatted.append("{:.10f}".format(total_walksat_time))
                
                # For ETS: use sum of subproblem energies
                energy_coefficient = 8.49e-03  # Energy coefficient from original code
                total_energy = sum(float(sd["hardware_time_seconds"][run_idx]) * energy_coefficient for sd in sub_data)
                total_energies.append(total_energy)
                total_energies_formatted.append("{:.10f}".format(total_energy))
                
                # Check if ALL subproblems were solved in this run
                all_solved = all(sd["n_unsat_clauses"][run_idx] == 0 for sd in sub_data)
                unsat_clauses.append(0 if all_solved else 1)  # 0 if all solved, 1 if any unsolved
                
                # Combine configurations
                combined_config = []
                for sd in sub_data:
                    if run_idx < len(sd["configurations"]):
                        combined_config.extend(sd["configurations"][run_idx])
                configurations.append(combined_config)
                
                if all_solved:
                    runs_solved += 1
            
            # Calculate CPU energy for decomposed problems
            cpu_energy_joules = [float(t) * EFFECTIVE_CORE_TDP for t in walksat_times]
            
            # Update the benchmark with correct sequential metrics
            benchmarks_data[orig_benchmark_idx]["runs_solved"] = runs_solved
            benchmarks_data[orig_benchmark_idx]["hardware_time_seconds"] = sequential_times_formatted  # CHANGED: Using sequential times
            benchmarks_data[orig_benchmark_idx]["cpu_time_seconds"] = walksat_times_formatted
            benchmarks_data[orig_benchmark_idx]["cpu_energy_joules"] = cpu_energy_joules
            benchmarks_data[orig_benchmark_idx]["hardware_energy_joules"] = total_energies_formatted
            benchmarks_data[orig_benchmark_idx]["n_unsat_clauses"] = unsat_clauses
            benchmarks_data[orig_benchmark_idx]["configurations"] = configurations
            benchmarks_data[orig_benchmark_idx]["is_decomposed"] = True  # Mark as decomposed
            
            # Update the TTS/ETS statistics
            runtimes = np.array(sequential_times)  # CHANGED: Using sequential times
            success_flags = np.array([unsat == 0 for unsat in unsat_clauses])
            successful_runtimes = runtimes[success_flags] if any(success_flags) else np.array([])
            
            if len(successful_runtimes
    import numpy as np

    # Group solutions by original problem
    problem_groups = {}
    for prob_info in problem_mappings:
        if prob_info.get('is_split'):
            group = prob_info['split_group']
            original_file = prob_info['original_file']
            if group not in problem_groups:
                problem_groups[group] = {'components': [], 'original_file': original_file}
            problem_groups[group]['components'].append(prob_info)

    reconstructed = {}
    solution_stats = {}
    best_effort_solutions = {}
    print(f"Reconstructing solutions for {len(problem_groups)} problem groups")

    # First pass – find best partial solutions for each sub-problem
    for group, info in problem_groups.items():
        print(f"Processing group: {group}")
        best_component_solutions = []
        for comp in info['components']:
            sub_path = comp['sub_problem_file']
            sub_file = os.path.basename(sub_path)
            print(f"  Finding solutions for component: {sub_file}")
            best_partial = find_best_partial_solutions(sub_file, cnfs_folder)
            if best_partial:
                mapped_sols = []
                for sol, unsat_count in best_partial:
                    mapped_sol = map_solution_to_original(sol, comp)
                    mapped_sols.append((mapped_sol, unsat_count))
                if mapped_sols:
                    best_component_solutions.append(mapped_sols)
                    print(f"    Found {len(mapped_sols)} mapped solutions")
        if best_component_solutions:
            best_effort_solutions[group] = best_component_solutions

    # Second pass – combine and refine partial solutions with WalkSAT
    for group, component_solutions in best_effort_solutions.items():
        valid_solutions = set()
        all_var_assignments = []
        for comp_sols in component_solutions:
            for sol, _ in comp_sols:
                var_dict = {abs(v): v > 0 for v in sol}
                all_var_assignments.append(var_dict)
        if all_var_assignments:
            combined_assignment = {}
            all_vars = set()
            for asgn in all_var_assignments:
                all_vars.update(asgn.keys())
            for var in all_vars:
                pos_count = sum(1 for asgn in all_var_assignments if var in asgn and asgn[var])
                neg_count = sum(1 for asgn in all_var_assignments if var in asgn and not asgn[var])
                combined_assignment[var] = True if pos_count >= neg_count else False
            combined_sol = [var if val else -var for var, val in combined_assignment.items()]

            original_file = problem_groups[group]['original_file']
            if os.path.exists(original_file):
                print(f"Validating and refining solution for: {original_file}")
                initial_unsat = compute_unsat_count(combined_sol, original_file)
                print(f"Initial combined solution has {initial_unsat} unsatisfied clauses")
                total_clauses = count_clauses(original_file)
                initial_sat_pct = ((total_clauses - initial_unsat) / total_clauses) * 100 if total_clauses > 0 else 0
                print(f"Initial satisfaction: {initial_sat_pct:.2f}% ({total_clauses-initial_unsat}/{total_clauses})")
                best_refined_sol = combined_sol
                best_unsat = initial_unsat
                for attempt in range(5):
                    print(f"  Refinement attempt {attempt+1}/5 using WalkSAT...")
                    refined_sol = refine_solution(combined_sol, original_file, max_flips=100000, random_seed=attempt)
                    if refined_sol:
                        refined_unsat = compute_unsat_count(refined_sol, original_file)
                        if refined_unsat < best_unsat:
                            best_unsat = refined_unsat
                            best_refined_sol = refined_sol
                            print(f"    New best solution: {refined_unsat} unsatisfied clauses")
                            if refined_unsat == 0:
                                print("    Found perfect solution!")
                                break
                final_sat_pct = ((total_clauses - best_unsat) / total_clauses) * 100 if total_clauses > 0 else 0
                print(f"Final solution: {best_unsat} unsatisfied clauses ({final_sat_pct:.2f}% satisfied)")
                solution_stats[group] = {
                    'initial_unsat': initial_unsat,
                    'final_unsat': best_unsat,
                    'total_clauses': total_clauses,
                    'initial_sat_pct': initial_sat_pct,
                    'final_sat_pct': final_sat_pct,
                    'is_sat': best_unsat == 0
                }
                valid_solutions.add(tuple(sorted(best_refined_sol)))
            else:
                print(f"Original file not found, skipping refinement: {original_file}")
                valid_solutions.add(tuple(sorted(combined_sol)))
        reconstructed[group] = valid_solutions

    solution_stats_path = os.path.join("running", "solution_stats.json")
    try:
        with open(solution_stats_path, 'w') as f:
            json.dump(solution_stats, f, indent=2)
    except Exception as e:
        print(f"Error saving solution stats: {e}")
    return reconstructed