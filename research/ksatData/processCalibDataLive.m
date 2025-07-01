% Project: Data processing for k-SAT chip
% Authors: Luke Wormald

clear all; %#ok<CLALL>
set(groot, 'DefaultFigurePosition', [0, 0, 100, 100]);

% Initialize path variables
batch_path = 'satlib/uf50-218/';
problem_path = strcat('CNF_Files/', batch_path);
results_path = strcat('/Volumes/NO NAME/BIN_Files/', batch_path);

dig_freq = 915E3 * 1024;
clk_div = 8;
ana_freq = dig_freq / clk_div;
timeout = 10000E-6;

coupling = false;

% Read in problem file names
files = struct2table(dir(problem_path)).name;
files(1:3) = [];
files = natsortfiles(files);

% Read in result file names
resultList = string(struct2table(dir(results_path + "/*_*.results")).name);
resultList = natsortfiles(resultList);

% Calculate number of different operating points
numPoints = length(resultList) / length(files);

% Preallocate file path array
problem_paths = strings(length(files), 1);
results_paths = strings(length(resultList), 1);

% Preallocate operating point arrays
vdd = zeros(numPoints, 1);
vcm = zeros(numPoints, 1);
vref = zeros(numPoints, 1);
i_tia = zeros(numPoints, 1);
i_bld_n = zeros(numPoints, 1);
i_break = zeros(numPoints, 1);
i_bld_p = zeros(numPoints, 1);
i_make = zeros(numPoints, 1);
i_cmp = zeros(numPoints, 1);

% Preallocate satisfaction arrays
numRuns = zeros(length(files), numPoints);
numPass = zeros(length(files), numPoints);
passRate = zeros(length(files), numPoints); %#ok<PREALL>

% Preallocate TTS metric arrays
avgTTS = zeros(length(files), numPoints);
stdTTS = zeros(length(files), numPoints);
medTTS = zeros(length(files), numPoints);
minTTS = zeros(length(files), numPoints);
maxTTS = zeros(length(files), numPoints);

TTSs = cell(length(files), numPoints);
%%
%[text] ## For all operating points
for i =1:numPoints
  % Parse filename for operating points
  temp = split(resultList(i), "_");

  vdd(i) = str2double(temp(2));
  vcm(i) = str2double(temp(3));
  vref(i) = str2double(temp(4));
  i_tia(i) = str2double(temp(5));
  i_bld_n(i) = str2double(temp(6));
  i_break(i) = str2double(temp(7));
  i_make(i) = str2double(temp(8));
  i_bld_p(i) = str2double(temp(9));
  i_cmp(i) = str2double(erase(temp(10), ".results"));
end
%%
%[text] ## For all files
for i = 1:length(files)
  % Assign problem file path
  problem_paths(i) = strcat(problem_path, files{i});

  % Read in problem cnf file
  [numVar, numCls, clauses] = readCNF(problem_paths(i));

  for j = 1:numPoints
    % Assign result file path
    results_paths(numPoints*(i-1) + j) = strcat(results_path, resultList(numPoints*(i-1) + j));
  
    % Read in results binary file
    dataID = fopen(results_paths(numPoints*(i-1) + j));
    data = fread(dataID, 'uint32');
    fclose(dataID);
  
    % Record numbe rof runs
    numRuns(i, j) = int64(length(data) / 9);
  
    % Preallocate TTS array
    TTS = zeros(numRuns(i, j), 1);
    unsatClauses = zeros(numRuns(i, j), 1);
    douts = zeros(numRuns(i, j), numVar);
  
    % Process data for all runs of the problem
    for k = 1:numRuns(i, j)
      [pass, clsUnsat, dout] = checkSAT(clauses, data((9 * k - 8):(9 * k - 2)));
      numPass(i, j) = numPass(i, j) + pass;
  
      TTS(k) = data(9*k-1) * (1/ana_freq) + data(9*k)*timeout;
      unsatClauses(k) = clsUnsat;
      douts(k,:) = dout(1:numVar);
    end
  
    TTSs{i, j} = TTS;
  
    % Calculate TTS metrics for problem
    avgTTS(i, j) = mean(TTS);
    stdTTS(i, j) = std(TTS);
    medTTS(i, j) = median(TTS);
    minTTS(i, j) = min(TTS);
    maxTTS(i, j) = max(TTS);

  end
end

% Calculate pass rate for each problem
passRate = numPass ./ numRuns;

% Calculate batch statistics
passRateTotal = sum(numPass, 1) ./ sum(numRuns, 1);
avgTotalTTS = mean(avgTTS, 1);
stdTotalTTS = std(avgTTS, 0, 1);
medTotalTTS = median(medTTS, 1);
minTotalTTS = min(minTTS, [], 1);
maxTotalTTS = max(maxTTS, [], 1);

%%
%[text] ## Make/Break Plots
figure(1); %[output:468911e3]
subplot(2, 2, 1); %[output:468911e3]
scatter(i_make, avgTotalTTS); %[output:468911e3]
title("Mean TTS vs I\_MAKE"); %[output:468911e3]
ylabel("Time (s)"); %[output:468911e3]
xlabel("Current (uA)"); %[output:468911e3]

subplot(2, 2, 2); %[output:468911e3]
scatter(i_break, avgTotalTTS); %[output:468911e3]
title("Mean TTS vs I\_BREAK "); %[output:468911e3]
ylabel("Time (s)"); %[output:468911e3]
xlabel("Current (uA)"); %[output:468911e3]

subplot(2, 2, 3) %[output:468911e3]
scatter(i_make, stdTotalTTS); %[output:468911e3]
title("Stdev TTS vs I\_MAKE"); %[output:468911e3]
ylabel("Time (s)"); %[output:468911e3]
xlabel("Current (uA)"); %[output:468911e3]

subplot(2, 2, 4) %[output:468911e3]
scatter(i_break, stdTotalTTS); %[output:468911e3]
title("Stdev TTS vs I\_BREAK"); %[output:468911e3]
ylabel("Time (s)"); %[output:468911e3]
xlabel("Current (uA)"); %[output:468911e3]

sgtitle("For All Solutions Regardless of Accuracy") %[output:468911e3]

figure(2); %[output:3db12380]
subplot(2, 2, 1); %[output:3db12380]
scatter(i_make, medTotalTTS); %[output:3db12380]
title("Median TTS vs I\_MAKE"); %[output:3db12380]
ylabel("Time (s)"); %[output:3db12380]
xlabel("Current (uA)"); %[output:3db12380]

subplot(2, 2, 2); %[output:3db12380]
scatter(i_break, medTotalTTS); %[output:3db12380]
title("Median TTS vs I\_BREAK"); %[output:3db12380]
ylabel("Time (s)"); %[output:3db12380]
xlabel("Current (uA)"); %[output:3db12380]

subplot(2, 2, 3) %[output:3db12380]
scatter(i_make, passRateTotal); %[output:3db12380]
title("Pass Rate vs I\_MAKE"); %[output:3db12380]
ylabel("Pass Rate"); %[output:3db12380]
xlabel("Current (uA)"); %[output:3db12380]

subplot(2, 2, 4) %[output:3db12380]
scatter(i_break, passRateTotal); %[output:3db12380]
title("Pass Rate vs I\_BREAK") %[output:3db12380]
ylabel("Pass Rate"); %[output:3db12380]
xlabel("Current (uA)"); %[output:3db12380]

sgtitle("For All Solutions Regardless of Accuracy") %[output:3db12380]

figure(3); %[output:1ea28ca2]
subplot(2, 2, 1); %[output:1ea28ca2]
scatter(i_make, maxTotalTTS); %[output:1ea28ca2]
title("Max TTS vs I\_MAKE"); %[output:1ea28ca2]
ylabel("Time (s)"); %[output:1ea28ca2]
xlabel("Current (uA)"); %[output:1ea28ca2]

subplot(2, 2, 2); %[output:1ea28ca2]
scatter(i_break, maxTotalTTS); %[output:1ea28ca2]
title("Max TTS vs I\_BREAK"); %[output:1ea28ca2]
ylabel("Time (s)"); %[output:1ea28ca2]
xlabel("Current (uA)"); %[output:1ea28ca2]

subplot(2, 2, 3) %[output:1ea28ca2]
scatter(i_make, minTotalTTS); %[output:1ea28ca2]
title("Min TTS vs I\_MAKE"); %[output:1ea28ca2]
ylabel("Time (s)"); %[output:1ea28ca2]
xlabel("Current (uA)"); %[output:1ea28ca2]

subplot(2, 2, 4) %[output:1ea28ca2]
scatter(i_break, minTotalTTS); %[output:1ea28ca2]
title("Min TTS vs I\_BREAK") %[output:1ea28ca2]
ylabel("Time (s)"); %[output:1ea28ca2]
xlabel("Current (uA)"); %[output:1ea28ca2]

sgtitle("For All Solutions Regardless of Accuracy") %[output:1ea28ca2]


figure(4); %[output:0bcfebb0]
subplot(2, 3, 1); %[output:0bcfebb0]
scatter(i_make./i_break, avgTotalTTS); %[output:0bcfebb0]
title("Median TTS vs Make/Break Ratio"); %[output:0bcfebb0]
ylabel("Time (s)"); %[output:0bcfebb0]
xlabel("Make/Break Ratio"); %[output:0bcfebb0]

subplot(2, 3, 2); %[output:0bcfebb0]
scatter(i_make./i_break, medTotalTTS); %[output:0bcfebb0]
title("Median TTS vs Make/Break Ratio"); %[output:0bcfebb0]
ylabel("Time (s)"); %[output:0bcfebb0]
xlabel("Make/Break Ratio"); %[output:0bcfebb0]

subplot(2, 3, 3); %[output:0bcfebb0]
scatter(i_make./i_break, maxTotalTTS); %[output:0bcfebb0]
title("Max TTS vs Make/Break Ratio"); %[output:0bcfebb0]
ylabel("Time (s)"); %[output:0bcfebb0]
xlabel("Make/Break Ratio"); %[output:0bcfebb0]

subplot(2, 3, 4) %[output:0bcfebb0]
scatter(i_make./i_break, stdTotalTTS); %[output:0bcfebb0]
title("Pass Rate vs Make/Break Ratio"); %[output:0bcfebb0]
ylabel("Pass Rate"); %[output:0bcfebb0]
xlabel("Make/Break Ratio"); %[output:0bcfebb0]

subplot(2, 3, 5) %[output:0bcfebb0]
scatter(i_make./i_break, passRateTotal); %[output:0bcfebb0]
title("Pass Rate vs Make/Break Ratio") %[output:0bcfebb0]
ylabel("Pass Rate"); %[output:0bcfebb0]
xlabel("Make/Break Ratio"); %[output:0bcfebb0]

subplot(2, 3, 6); %[output:0bcfebb0]
scatter(i_make./i_break, minTotalTTS); %[output:0bcfebb0]
title("Min TTS vs Make/Break Ratio"); %[output:0bcfebb0]
ylabel("Time (s)"); %[output:0bcfebb0]
xlabel("Make/Break Ratio"); %[output:0bcfebb0]

sgtitle("For All Solutions Regardless of Accuracy") %[output:0bcfebb0]


figure(5); %[output:4f09d132]
subplot(2, 2, 1) %[output:4f09d132]
scatter(i_make(passRateTotal==1), avgTotalTTS(passRateTotal==1)); %[output:4f09d132]
title("Mean TTS vs I\_MAKE"); %[output:4f09d132]
ylabel("Time (s)"); %[output:4f09d132]
xlabel("Current (uA)"); %[output:4f09d132]

subplot(2, 2, 2) %[output:4f09d132]
scatter(i_break(passRateTotal==1), avgTotalTTS(passRateTotal==1)); %[output:4f09d132]
title("Mean TTS vs I\_BREAK "); %[output:4f09d132]
ylabel("Time (s)"); %[output:4f09d132]
xlabel("Current (uA)"); %[output:4f09d132]

subplot(2, 2, 3) %[output:4f09d132]
scatter(i_make(passRateTotal==1), stdTotalTTS(passRateTotal==1)); %[output:4f09d132]
title("Stdev TTS vs I\_MAKE") %[output:4f09d132]
ylabel("Time (s)"); %[output:4f09d132]
xlabel("Current (uA)"); %[output:4f09d132]

subplot(2, 2, 4) %[output:4f09d132]
scatter(i_break(passRateTotal==1), stdTotalTTS(passRateTotal==1)); %[output:4f09d132]
title("Stdev TTS vs I\_BREAK") %[output:4f09d132]
ylabel("Time (s)"); %[output:4f09d132]
xlabel("Current (uA)"); %[output:4f09d132]

sgtitle("For 100% Accurate Solutions Only") %[output:4f09d132]

%[appendix]{"version":"1.0"}
%---
%[metadata:view]
%   data: {"layout":"inline","rightPanelPercent":34.7}
%---
%[output:468911e3]
%   data: {"dataType":"image","outputData":{"dataUri":"data:,","height":0,"width":0}}
%---
%[output:3db12380]
%   data: {"dataType":"image","outputData":{"dataUri":"data:,","height":0,"width":0}}
%---
%[output:1ea28ca2]
%   data: {"dataType":"image","outputData":{"dataUri":"data:,","height":0,"width":0}}
%---
%[output:0bcfebb0]
%   data: {"dataType":"image","outputData":{"dataUri":"data:,","height":0,"width":0}}
%---
%[output:4f09d132]
%   data: {"dataType":"image","outputData":{"dataUri":"data:,","height":0,"width":0}}
%---
