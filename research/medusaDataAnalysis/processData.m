% Project: Data processing for k-SAT chip
% Authors: Luke Wormald

clear;

% Initialize path variables
batch_path = 'satlib/uf50-218/';
% batch_path = 'tentative_batches/hardware/t_batch_3/';
% batch_path = 'tentative_batches/projected/t_batch_0/';
problem_path = strcat('CNF_Files/', batch_path);
results_path = strcat('/Volumes/NO NAME/BIN_Files/', batch_path);

power = 0.006;

dig_freq = 915E3 * 1024;
clk_div = 8;
ana_freq = dig_freq / clk_div;
timeout = 10000E-6;

coupling = false;

% Read in problem/result file names
files = struct2table(dir(problem_path)).name;
files(1:3) = [];
files = natsortfiles(files);

% Preallocate file path array
problem_paths = strings(length(files), 1);
results_paths = strings(length(files), 1);

% Preallocate satisfaction arrays
numRuns = zeros(length(files), 1);
numPass = zeros(length(files), 1);
passRate = zeros(length(files), 1);

% Preallocate TTS metric arrays
avgTTS = zeros(length(files), 1);
stdTTS = zeros(length(files), 1);
medTTS = zeros(length(files), 1);
minTTS = zeros(length(files), 1);
maxTTS = zeros(length(files), 1);

TTSs = cell(length(files), 1);

% Format JSON Solver Metadata
jsonSolver.solver = 'k-SAT Solver IC';
jsonSolver.hardware = 'CPU:M4 Pro';

jsonStructs = cell(length(files), 1);

%% For all files
for i = 1:length(files)
  S = struct;

  % Assign file paths
  problem_paths(i) = strcat(problem_path, files{i});
  results_paths(i) = strcat(results_path, files{i}, '.bin.results');

  % Read in problem cnf file
  [numVar, numCls, clauses] = readCNF(problem_paths(i));

  % Read in results binary file
  dataID = fopen(results_paths(i));
  data = fread(dataID, 'uint32');
  fclose(dataID);

  % Record numbe rof runs
  numRuns(i) = int64(length(data) / 9);

  % Preallocate TTS array
  TTS = zeros(numRuns(i), 1);
  unsatClauses = zeros(numRuns(i), 1);
  douts = zeros(numRuns(i), numVar);

  % Process data for all runs of the problem
  for j = 1:numRuns(i)
    [pass, clsUnsat, dout] = checkSAT(clauses, data((9 * j - 8):(9 * j - 2)));
    numPass(i) = numPass(i) + pass;

    TTS(j) = data(9*j-1) * (1/ana_freq) + data(9*j)*timeout;
    unsatClauses(j) = clsUnsat;
    douts(j,:) = dout(1:numVar);
  end

  ETS = TTS .* power;
  TTSs{i} = TTS;

  % Calculate TTS metrics for problem
  avgTTS(i) = mean(TTS);
  stdTTS(i) = std(TTS);
  medTTS(i) = median(TTS);
  minTTS(i) = min(TTS);
  maxTTS(i) = max(TTS);

  % % Format JSON Benchmark Results
  % S.set = batch_path;
  % S.instance_idx = i - 1;
  % S.cutoff_type = 'time_seconds';
  % S.cutoff = 2^32 / ana_freq;
  % S.runs_attempted = numRuns(i);
  % S.runs_solved = numPass(i);
  % S.n_unsat_clauses = unsatClauses;
  % S.configurations = douts;
  % 
  % % Format JSON Benchmark Resources
  % S.pre_cpu_time_seconds = zeros(numRuns(i), 1);
  % S.pre_cpu_energy_joules = zeros(numRuns(i), 1);
  % S.pre_runtime_seconds = zeros(numRuns(i), 1);
  % S.pre_energy_joules = zeros(numRuns(i), 1);
  % S.cpu_time_seconds = zeros(numRuns(i), 1);
  % S.cpu_energy_joules = zeros(numRuns(i), 1);
  % S.hardware_time_second = TTS;
  % S.hardware_energy_joules = ETS;
  % S.hardware_calls = ones(numRuns(i), 1);
  % S.solver_iterations = ones(numRuns(i), 1);
  % 
  % jsonStructs{i} = S;
end

% Calculate pass rate for each problem
passRate = numPass ./ numRuns;

% Calculate batch statistics
passRateTotal = sum(numPass) / sum(numRuns);
avgTotalTTS = mean(avgTTS);
medTotalTTS = median(medTTS);
minTotalTTS = min(minTTS);
maxTotalTTS = max(maxTTS);

% fid = fopen('projected_t_batch_0.json','w');
% 
% fprintf(fid, '%s', jsonencode(jsonSolver,"PrettyPrint",true));
% 
% for i = 1:length(files)
%   fprintf(fid, '%s', jsonencode(jsonStructs{i}, "PrettyPrint",true));
% end
% 
% fclose(fid);