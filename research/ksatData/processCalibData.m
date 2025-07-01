%% Project: Data processing for k-SAT chip
%  Authors: Luke Wormald

clear;
addpath("./CalibDataFunctions/")

% Initialize path variables
batch_path = 'satlib/uf50-218/';
problem_path = strcat('CNF_Files/', batch_path);
results_path = strcat('/Volumes/NO NAME 1/BIN_Files/', batch_path);

dig_freq = 888E3 * 1024;
clk_div = 8;
ana_freq = dig_freq / clk_div;
timeout = 10000E-6;

coupling = false;

% Read in problem file names
files = struct2table(dir(problem_path)).name;
files(1:3) = [];
files = natsortfiles(files);
numProbs = length(files);

% Read in result file names
resultList = string(struct2table(dir(results_path + "/*_*.results")).name);
resultList = natsortfiles(resultList);

% Calculate number of different operating points
numPoints = length(resultList) / numProbs;

% Preallocate file path array
problem_paths = strings(numProbs, 1);
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
numRuns = zeros(numProbs, numPoints);
numPass = zeros(numProbs, numPoints);
passRate = zeros(numProbs, numPoints); %#ok<PREALL>

% Preallocate TTS metric arrays
avgTTS = zeros(numProbs, numPoints);
stdTTS = zeros(numProbs, numPoints);
medTTS = zeros(numProbs, numPoints);
minTTS = zeros(numProbs, numPoints);
maxTTS = zeros(numProbs, numPoints);

TTSs = cell(numProbs, numPoints);

% For all operating points
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


%% Process results
% For all files
for i = 1:numProbs
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

% Calculate estimated power for all operating points
[power, i_make_int, i_break_int, i_bld_p_int, i_bld_n_int, i_cmp_int, i_tia_int] = estPwr(numVar, numCls, vdd, i_make, i_break, i_bld_p, i_bld_n, i_cmp, i_tia);
avgTotalETS = avgTotalTTS .* power.';

%% Print best operating point
[bestTTS, bestIdx] = min(avgTotalTTS);
dispOpPoint(bestIdx, strcat("Best TTS Time: ", string(avgTotalTTS(bestIdx))), vdd, vcm, vref, i_make, i_break, i_bld_p, i_bld_n, i_cmp, i_tia);

[bestETS, bestIdx] = min(avgTotalETS);
dispOpPoint(bestIdx, strcat("Best ETS Time: ", string(avgTotalTTS(bestIdx))), vdd, vcm, vref, i_make, i_break, i_bld_p, i_bld_n, i_cmp, i_tia);
%% Plot Make and Break Current Results

% Plot mean TTS and TTS standard deviation for all solutions
figure(1);
subplot(2, 2, 1);
scatter(i_make, avgTotalTTS);
title("Mean TTS vs I\_MAKE");
ylabel("Time (s)");
xlabel("Current (uA)");

subplot(2, 2, 2);
scatter(i_break, avgTotalTTS);
title("Mean TTS vs I\_BREAK ");
ylabel("Time (s)");
xlabel("Current (uA)");

subplot(2, 2, 3)
scatter(i_make, stdTotalTTS);
title("Stdev TTS vs I\_MAKE");
ylabel("Time (s)");
xlabel("Current (uA)");

subplot(2, 2, 4)
scatter(i_break, stdTotalTTS);
title("Stdev TTS vs I\_BREAK");
ylabel("Time (s)");
xlabel("Current (uA)");

sgtitle("For All Solutions Regardless of Accuracy")

% Plot median TTS and pass rate for all solutions
figure(2);
subplot(2, 2, 1);
scatter(i_make, medTotalTTS);
title("Median TTS vs I\_MAKE");
ylabel("Time (s)");
xlabel("Current (uA)");

subplot(2, 2, 2);
scatter(i_break, medTotalTTS);
title("Median TTS vs I\_BREAK");
ylabel("Time (s)");
xlabel("Current (uA)");

subplot(2, 2, 3)
scatter(i_make, passRateTotal);
title("Pass Rate vs I\_MAKE");
ylabel("Pass Rate");
xlabel("Current (uA)");

subplot(2, 2, 4)
scatter(i_break, passRateTotal);
title("Pass Rate vs I\_BREAK")
ylabel("Pass Rate");
xlabel("Current (uA)");

sgtitle("For All Solutions Regardless of Accuracy")

% Plot maximum and minumum TTS for all solutions
figure(3);
subplot(2, 2, 1);
scatter(i_make, maxTotalTTS);
title("Max TTS vs I\_MAKE");
ylabel("Time (s)");
xlabel("Current (uA)");

subplot(2, 2, 2);
scatter(i_break, maxTotalTTS);
title("Max TTS vs I\_BREAK");
ylabel("Time (s)");
xlabel("Current (uA)");

subplot(2, 2, 3)
scatter(i_make, minTotalTTS);
title("Min TTS vs I\_MAKE");
ylabel("Time (s)");
xlabel("Current (uA)");

subplot(2, 2, 4)
scatter(i_break, minTotalTTS);
title("Min TTS vs I\_BREAK")
ylabel("Time (s)");
xlabel("Current (uA)");

sgtitle("For All Solutions Regardless of Accuracy")

% Plot outputs with respect to the Make/Break ratio for all solutions
figure(4);
subplot(2, 3, 1);
scatter(i_make./i_break, avgTotalTTS);
title("Mean TTS vs Make/Break Ratio");
ylabel("Time (s)");
xlabel("Make/Break Ratio");

subplot(2, 3, 2);
scatter(i_make./i_break, medTotalTTS);
title("Median TTS vs Make/Break Ratio");
ylabel("Time (s)");
xlabel("Make/Break Ratio");

subplot(2, 3, 3);
scatter(i_make./i_break, maxTotalTTS);
title("Max TTS vs Make/Break Ratio");
ylabel("Time (s)");
xlabel("Make/Break Ratio");

subplot(2, 3, 4)
scatter(i_make./i_break, stdTotalTTS);
title("Stdev TTS vs Make/Break Ratio");
ylabel("Pass Rate");
xlabel("Make/Break Ratio");

subplot(2, 3, 5)
scatter(i_make./i_break, passRateTotal);
title("Pass Rate vs Make/Break Ratio")
ylabel("Pass Rate");
xlabel("Make/Break Ratio");

subplot(2, 3, 6);
scatter(i_make./i_break, minTotalTTS);
title("Min TTS vs Make/Break Ratio");
ylabel("Time (s)");
xlabel("Make/Break Ratio");

sgtitle("For All Solutions Regardless of Accuracy")

% Plot mean TTS and TTS standard deviation for 100% accurate solutions
figure(5);
subplot(2, 2, 1)
scatter(i_make(passRateTotal==1), avgTotalTTS(passRateTotal==1));
title("Mean TTS vs I\_MAKE");
ylabel("Time (s)");
xlabel("Current (uA)");

subplot(2, 2, 2)
scatter(i_break(passRateTotal==1), avgTotalTTS(passRateTotal==1));
title("Mean TTS vs I\_BREAK ");
ylabel("Time (s)");
xlabel("Current (uA)");

subplot(2, 2, 3)
scatter(i_make(passRateTotal==1), stdTotalTTS(passRateTotal==1));
title("Stdev TTS vs I\_MAKE")
ylabel("Time (s)");
xlabel("Current (uA)");

subplot(2, 2, 4)
scatter(i_break(passRateTotal==1), stdTotalTTS(passRateTotal==1));
title("Stdev TTS vs I\_BREAK")
ylabel("Time (s)");
xlabel("Current (uA)");

sgtitle("For 100% Accurate Solutions Only")

% Plot median TTS and pass rate for 100% accurate solutions
figure(6);
subplot(2, 2, 1);
scatter(i_make(passRateTotal==1), medTotalTTS(passRateTotal==1));
title("Median TTS vs I\_MAKE");
ylabel("Time (s)");
xlabel("Current (uA)");

subplot(2, 2, 2);
scatter(i_break(passRateTotal==1), medTotalTTS(passRateTotal==1));
title("Median TTS vs I\_BREAK");
ylabel("Time (s)");
xlabel("Current (uA)");

subplot(2, 2, 3)
scatter(i_make(passRateTotal==1), passRateTotal(passRateTotal==1));
title("Pass Rate vs I\_MAKE");
ylabel("Pass Rate");
xlabel("Current (uA)");

subplot(2, 2, 4)
scatter(i_break(passRateTotal==1), passRateTotal(passRateTotal==1));
title("Pass Rate vs I\_BREAK")
ylabel("Pass Rate");
xlabel("Current (uA)");

sgtitle("For 100% Accurate Solutions Only")

% Plot maximum and minumum TTS for 100% accurate solutions
figure(7);
subplot(2, 2, 1);
scatter(i_make(passRateTotal==1), maxTotalTTS(passRateTotal==1));
title("Max TTS vs I\_MAKE");
ylabel("Time (s)");
xlabel("Current (uA)");

subplot(2, 2, 2);
scatter(i_break(passRateTotal==1), maxTotalTTS(passRateTotal==1));
title("Max TTS vs I\_BREAK");
ylabel("Time (s)");
xlabel("Current (uA)");

subplot(2, 2, 3)
scatter(i_make(passRateTotal==1), minTotalTTS(passRateTotal==1));
title("Min TTS vs I\_MAKE");
ylabel("Time (s)");
xlabel("Current (uA)");

subplot(2, 2, 4)
scatter(i_break(passRateTotal==1), minTotalTTS(passRateTotal==1));
title("Min TTS vs I\_BREAK")
ylabel("Time (s)");
xlabel("Current (uA)");

sgtitle("For 100% Accurate Solutions Only")

% Plot outputs with respect to the Make/Break ratio for 100% accurate solutions
figure(8);
subplot(2, 3, 1);
scatter(i_make(passRateTotal==1)./i_break(passRateTotal==1), avgTotalTTS(passRateTotal==1));
title("Mean TTS vs Make/Break Ratio");
ylabel("Time (s)");
xlabel("Make/Break Ratio");

subplot(2, 3, 2);
scatter(i_make(passRateTotal==1)./i_break(passRateTotal==1), medTotalTTS(passRateTotal==1));
title("Median TTS vs Make/Break Ratio");
ylabel("Time (s)");
xlabel("Make/Break Ratio");

subplot(2, 3, 3);
scatter(i_make(passRateTotal==1)./i_break(passRateTotal==1), maxTotalTTS(passRateTotal==1));
title("Max TTS vs Make/Break Ratio");
ylabel("Time (s)");
xlabel("Make/Break Ratio");

subplot(2, 3, 4)
scatter(i_make(passRateTotal==1)./i_break(passRateTotal==1), stdTotalTTS(passRateTotal==1));
title("Stdev TTS vs Make/Break Ratio");
ylabel("Pass Rate");
xlabel("Make/Break Ratio");

subplot(2, 3, 5)
scatter(i_make(passRateTotal==1)./i_break(passRateTotal==1), passRateTotal(passRateTotal==1));
title("Pass Rate vs Make/Break Ratio")
ylabel("Pass Rate");
xlabel("Make/Break Ratio");

subplot(2, 3, 6);
scatter(i_make(passRateTotal==1)./i_break(passRateTotal==1), minTotalTTS(passRateTotal==1));
title("Min TTS vs Make/Break Ratio");
ylabel("Time (s)");
xlabel("Make/Break Ratio");

sgtitle("For 100% Accurate Solutions Only")


%% Plot Bleed_P and Bleed_N Current Results

% Plot mean TTS and TTS standard deviation for all solutions
figure(9);
subplot(2, 2, 1);
scatter(i_bld_p, avgTotalTTS);
title("Mean TTS vs I\_BLD\_P");
ylabel("Time (s)");
xlabel("Current (uA)");

subplot(2, 2, 2);
scatter(i_bld_n, avgTotalTTS);
title("Mean TTS vs I\_BLD\_N ");
ylabel("Time (s)");
xlabel("Current (uA)");

subplot(2, 2, 3)
scatter(i_bld_p, stdTotalTTS);
title("Stdev TTS vs I\_BLD\_P");
ylabel("Time (s)");
xlabel("Current (uA)");

subplot(2, 2, 4)
scatter(i_bld_n, stdTotalTTS);
title("Stdev TTS vs I\_BLD\_N");
ylabel("Time (s)");
xlabel("Current (uA)");

sgtitle("For All Solutions Regardless of Accuracy")

% Plot median TTS and pass rate for all solutions
figure(10);
subplot(2, 2, 1);
scatter(i_bld_p, medTotalTTS);
title("Median TTS vs I\_BLD\_P");
ylabel("Time (s)");
xlabel("Current (uA)");

subplot(2, 2, 2);
scatter(i_bld_n, medTotalTTS);
title("Median TTS vs I\_BLD\_N");
ylabel("Time (s)");
xlabel("Current (uA)");

subplot(2, 2, 3)
scatter(i_bld_p, passRateTotal);
title("Pass Rate vs I\_BLD\_P");
ylabel("Pass Rate");
xlabel("Current (uA)");

subplot(2, 2, 4)
scatter(i_bld_n, passRateTotal);
title("Pass Rate vs I\_BLD\_N")
ylabel("Pass Rate");
xlabel("Current (uA)");

sgtitle("For All Solutions Regardless of Accuracy")

% Plot maximum and minumum TTS for all solutions
figure(11);
subplot(2, 2, 1);
scatter(i_bld_p, maxTotalTTS);
title("Max TTS vs I\_BLD\_P");
ylabel("Time (s)");
xlabel("Current (uA)");

subplot(2, 2, 2);
scatter(i_bld_n, maxTotalTTS);
title("Max TTS vs I\_BLD\_N");
ylabel("Time (s)");
xlabel("Current (uA)");

subplot(2, 2, 3)
scatter(i_bld_p, minTotalTTS);
title("Min TTS vs I\_BLD\_P");
ylabel("Time (s)");
xlabel("Current (uA)");

subplot(2, 2, 4)
scatter(i_bld_n, minTotalTTS);
title("Min TTS vs I\_BLD\_N")
ylabel("Time (s)");
xlabel("Current (uA)");

sgtitle("For All Solutions Regardless of Accuracy")

% Plot outputs with respect to the BLD_P/BLD_N ratio for all solutions
figure(12);
subplot(2, 3, 1);
scatter(i_bld_p./i_bld_n, avgTotalTTS);
title("Mean TTS vs BLD\_P/BLD\_N Ratio");
ylabel("Time (s)");
xlabel("BLD\_P/BLD\_N Ratio");

subplot(2, 3, 2);
scatter(i_bld_p./i_bld_n, medTotalTTS);
title("Median TTS vs BLD\_P/BLD\_N Ratio");
ylabel("Time (s)");
xlabel("BLD\_P/BLD\_N Ratio");

subplot(2, 3, 3);
scatter(i_bld_p./i_bld_n, maxTotalTTS);
title("Max TTS vs BLD\_P/BLD\_N Ratio");
ylabel("Time (s)");
xlabel("BLD\_P/BLD\_N Ratio");

subplot(2, 3, 4)
scatter(i_bld_p./i_bld_n, stdTotalTTS);
title("Stdev TTS vs BLD\_P/BLD\_N Ratio");
ylabel("Pass Rate");
xlabel("BLD\_P/BLD\_N Ratio");

subplot(2, 3, 5)
scatter(i_bld_p./i_bld_n, passRateTotal);
title("Pass Rate vs BLD\_P/BLD\_N Ratio")
ylabel("Pass Rate");
xlabel("BLD\_P/BLD\_N Ratio");

subplot(2, 3, 6);
scatter(i_bld_p./i_bld_n, minTotalTTS);
title("Min TTS vs BLD\_P/BLD\_N Ratio");
ylabel("Time (s)");
xlabel("BLD\_P/BLD\_N Ratio");

sgtitle("For All Solutions Regardless of Accuracy")

% Plot mean TTS and TTS standard deviation for 100% accurate solutions
figure(13);
subplot(2, 2, 1)
scatter(i_bld_p(passRateTotal==1), avgTotalTTS(passRateTotal==1));
title("Mean TTS vs I\_BLD\_P");
ylabel("Time (s)");
xlabel("Current (uA)");

subplot(2, 2, 2)
scatter(i_bld_n(passRateTotal==1), avgTotalTTS(passRateTotal==1));
title("Mean TTS vs I\_BLD\_N ");
ylabel("Time (s)");
xlabel("Current (uA)");

subplot(2, 2, 3)
scatter(i_bld_p(passRateTotal==1), stdTotalTTS(passRateTotal==1));
title("Stdev TTS vs I\_BLD\_P")
ylabel("Time (s)");
xlabel("Current (uA)");

subplot(2, 2, 4)
scatter(i_bld_n(passRateTotal==1), stdTotalTTS(passRateTotal==1));
title("Stdev TTS vs I\_BLD\_N")
ylabel("Time (s)");
xlabel("Current (uA)");

sgtitle("For 100% Accurate Solutions Only")

% Plot median TTS and pass rate for 100% accurate solutions
figure(14);
subplot(2, 2, 1);
scatter(i_bld_p(passRateTotal==1), medTotalTTS(passRateTotal==1));
title("Median TTS vs I\_BLD\_P");
ylabel("Time (s)");
xlabel("Current (uA)");

subplot(2, 2, 2);
scatter(i_bld_n(passRateTotal==1), medTotalTTS(passRateTotal==1));
title("Median TTS vs I\_BLD\_N");
ylabel("Time (s)");
xlabel("Current (uA)");

subplot(2, 2, 3)
scatter(i_bld_p(passRateTotal==1), passRateTotal(passRateTotal==1));
title("Pass Rate vs I\_BLD\_P");
ylabel("Pass Rate");
xlabel("Current (uA)");

subplot(2, 2, 4)
scatter(i_bld_n(passRateTotal==1), passRateTotal(passRateTotal==1));
title("Pass Rate vs I\_BLD\_N")
ylabel("Pass Rate");
xlabel("Current (uA)");

sgtitle("For 100% Accurate Solutions Only")

% Plot maximum and minumum TTS for 100% accurate solutions
figure(15);
subplot(2, 2, 1);
scatter(i_bld_p(passRateTotal==1), maxTotalTTS(passRateTotal==1));
title("Max TTS vs I\_BLD\_P");
ylabel("Time (s)");
xlabel("Current (uA)");

subplot(2, 2, 2);
scatter(i_bld_n(passRateTotal==1), maxTotalTTS(passRateTotal==1));
title("Max TTS vs I\_BLD\_N");
ylabel("Time (s)");
xlabel("Current (uA)");

subplot(2, 2, 3)
scatter(i_bld_p(passRateTotal==1), minTotalTTS(passRateTotal==1));
title("Min TTS vs I\_BLD\_P");
ylabel("Time (s)");
xlabel("Current (uA)");

subplot(2, 2, 4)
scatter(i_bld_n(passRateTotal==1), minTotalTTS(passRateTotal==1));
title("Min TTS vs I\_BLD\_N")
ylabel("Time (s)");
xlabel("Current (uA)");

sgtitle("For 100% Accurate Solutions Only")

% Plot outputs with respect to the BLD_P/BLD_N ratio for 100% accurate solutions
figure(16);
subplot(2, 3, 1);
scatter(i_bld_p(passRateTotal==1)./i_bld_n(passRateTotal==1), avgTotalTTS(passRateTotal==1));
title("Mean TTS vs BLD\_P/BLD\_N Ratio");
ylabel("Time (s)");
xlabel("BLD_P/BLD_N Ratio");

subplot(2, 3, 2);
scatter(i_bld_p(passRateTotal==1)./i_bld_n(passRateTotal==1), medTotalTTS(passRateTotal==1));
title("Median TTS vs BLD\_P/BLD\_N Ratio");
ylabel("Time (s)");
xlabel("BLD\_P/BLD\_N Ratio");

subplot(2, 3, 3);
scatter(i_bld_p(passRateTotal==1)./i_bld_n(passRateTotal==1), maxTotalTTS(passRateTotal==1));
title("Max TTS vs BLD\_P/BLD\_N Ratio");
ylabel("Time (s)");
xlabel("BLD\_P/BLD\_N Ratio");

subplot(2, 3, 4)
scatter(i_bld_p(passRateTotal==1)./i_bld_n(passRateTotal==1), stdTotalTTS(passRateTotal==1));
title("Stdev vs BLD\_P/BLD\_N Ratio");
ylabel("Pass Rate");
xlabel("BLD\_P/BLD\_N Ratio");

subplot(2, 3, 5)
scatter(i_bld_p(passRateTotal==1)./i_bld_n(passRateTotal==1), passRateTotal(passRateTotal==1));
title("Pass Rate vs BLD\_P/BLD\_N Ratio")
ylabel("Pass Rate");
xlabel("BLD\_P/BLD\_N Ratio");

subplot(2, 3, 6);
scatter(i_bld_p(passRateTotal==1)./i_bld_n(passRateTotal==1), minTotalTTS(passRateTotal==1));
title("Min TTS vs BLD\_P/BLD\_N Ratio");
ylabel("Time (s)");
xlabel("BLD\_P/BLD\_N Ratio");

sgtitle("For 100% Accurate Solutions Only")


%% Plot Comaprator and TIA Current Results

% Plot mean TTS and TTS standard deviation for all solutions
figure(17);
subplot(2, 2, 1);
scatter(i_cmp, avgTotalTTS);
title("Mean TTS vs I\_CMP");
ylabel("Time (s)");
xlabel("Current (uA)");

subplot(2, 2, 2);
scatter(i_tia, avgTotalTTS);
title("Mean TTS vs I\_TIA ");
ylabel("Time (s)");
xlabel("Current (uA)");

subplot(2, 2, 3)
scatter(i_cmp, stdTotalTTS);
title("Stdev TTS vs I\_CMP");
ylabel("Time (s)");
xlabel("Current (uA)");

subplot(2, 2, 4)
scatter(i_tia, stdTotalTTS);
title("Stdev TTS vs I\_TIA");
ylabel("Time (s)");
xlabel("Current (uA)");

sgtitle("For All Solutions Regardless of Accuracy")

% Plot median TTS and pass rate for all solutions
figure(18);
subplot(2, 2, 1);
scatter(i_cmp, medTotalTTS);
title("Median TTS vs I\_CMP");
ylabel("Time (s)");
xlabel("Current (uA)");

subplot(2, 2, 2);
scatter(i_tia, medTotalTTS);
title("Median TTS vs I\_TIA");
ylabel("Time (s)");
xlabel("Current (uA)");

subplot(2, 2, 3)
scatter(i_cmp, passRateTotal);
title("Pass Rate vs I\_CMP");
ylabel("Pass Rate");
xlabel("Current (uA)");

subplot(2, 2, 4)
scatter(i_tia, passRateTotal);
title("Pass Rate vs I\_TIA")
ylabel("Pass Rate");
xlabel("Current (uA)");

sgtitle("For All Solutions Regardless of Accuracy")

% Plot maximum and minumum TTS for all solutions
figure(19);
subplot(2, 2, 1);
scatter(i_cmp, maxTotalTTS);
title("Max TTS vs I\_CMP");
ylabel("Time (s)");
xlabel("Current (uA)");

subplot(2, 2, 2);
scatter(i_tia, maxTotalTTS);
title("Max TTS vs I\_TIA");
ylabel("Time (s)");
xlabel("Current (uA)");

subplot(2, 2, 3)
scatter(i_cmp, minTotalTTS);
title("Min TTS vs I\_CMP");
ylabel("Time (s)");
xlabel("Current (uA)");

subplot(2, 2, 4)
scatter(i_tia, minTotalTTS);
title("Min TTS vs I\_TIA")
ylabel("Time (s)");
xlabel("Current (uA)");

sgtitle("For All Solutions Regardless of Accuracy")

% Plot mean TTS and TTS standard deviation for 100% accurate solutions
figure(20);
subplot(2, 2, 1)
scatter(i_cmp(passRateTotal==1), avgTotalTTS(passRateTotal==1));
title("Mean TTS vs I\_CMP");
ylabel("Time (s)");
xlabel("Current (uA)");

subplot(2, 2, 2)
scatter(i_tia(passRateTotal==1), avgTotalTTS(passRateTotal==1));
title("Mean TTS vs I\_TIA ");
ylabel("Time (s)");
xlabel("Current (uA)");

subplot(2, 2, 3)
scatter(i_cmp(passRateTotal==1), stdTotalTTS(passRateTotal==1));
title("Stdev TTS vs I\_CMP")
ylabel("Time (s)");
xlabel("Current (uA)");

subplot(2, 2, 4)
scatter(i_tia(passRateTotal==1), stdTotalTTS(passRateTotal==1));
title("Stdev TTS vs I\_TIA")
ylabel("Time (s)");
xlabel("Current (uA)");

sgtitle("For 100% Accurate Solutions Only")

% Plot median TTS and pass rate for 100% accurate solutions
figure(21);
subplot(2, 2, 1);
scatter(i_cmp(passRateTotal==1), medTotalTTS(passRateTotal==1));
title("Median TTS vs I\_CMP");
ylabel("Time (s)");
xlabel("Current (uA)");

subplot(2, 2, 2);
scatter(i_tia(passRateTotal==1), medTotalTTS(passRateTotal==1));
title("Median TTS vs I\_TIA");
ylabel("Time (s)");
xlabel("Current (uA)");

subplot(2, 2, 3)
scatter(i_cmp(passRateTotal==1), passRateTotal(passRateTotal==1));
title("Pass Rate vs I\_CMP");
ylabel("Pass Rate");
xlabel("Current (uA)");

subplot(2, 2, 4)
scatter(i_tia(passRateTotal==1), passRateTotal(passRateTotal==1));
title("Pass Rate vs I\_TIA")
ylabel("Pass Rate");
xlabel("Current (uA)");

sgtitle("For 100% Accurate Solutions Only")

% Plot maximum and minumum TTS for 100% accurate solutions
figure(22);
subplot(2, 2, 1);
scatter(i_cmp(passRateTotal==1), maxTotalTTS(passRateTotal==1));
title("Max TTS vs I\_CMP");
ylabel("Time (s)");
xlabel("Current (uA)");

subplot(2, 2, 2);
scatter(i_tia(passRateTotal==1), maxTotalTTS(passRateTotal==1));
title("Max TTS vs I\_TIA");
ylabel("Time (s)");
xlabel("Current (uA)");

subplot(2, 2, 3)
scatter(i_cmp(passRateTotal==1), minTotalTTS(passRateTotal==1));
title("Min TTS vs I\_CMP");
ylabel("Time (s)");
xlabel("Current (uA)");

subplot(2, 2, 4)
scatter(i_tia(passRateTotal==1), minTotalTTS(passRateTotal==1));
title("Min TTS vs I\_TIA")
ylabel("Time (s)");
xlabel("Current (uA)");

sgtitle("For 100% Accurate Solutions Only")


%% Plot Comparator VREF and TIA VCM Results

% Plot mean TTS and TTS standard deviation for all solutions
figure(23);
subplot(2, 2, 1);
scatter(vref, avgTotalTTS);
title("Mean TTS vs VREF");
ylabel("Time (s)");
xlabel("Voltage (V)");

subplot(2, 2, 2);
scatter(vcm, avgTotalTTS);
title("Mean TTS vs VCM ");
ylabel("Time (s)");
xlabel("Voltage (V)");

subplot(2, 2, 3)
scatter(vref, stdTotalTTS);
title("Stdev TTS vs VREF");
ylabel("Time (s)");
xlabel("Voltage (V)");

subplot(2, 2, 4)
scatter(vcm, stdTotalTTS);
title("Stdev TTS vs VCM");
ylabel("Time (s)");
xlabel("Voltage (V)");

sgtitle("For All Solutions Regardless of Accuracy")

% Plot median TTS and pass rate for all solutions
figure(24);
subplot(2, 2, 1);
scatter(vref, medTotalTTS);
title("Median TTS vs VREF");
ylabel("Time (s)");
xlabel("Voltage (V)");

subplot(2, 2, 2);
scatter(vcm, medTotalTTS);
title("Median TTS vs VCM");
ylabel("Time (s)");
xlabel("Voltage (V)");

subplot(2, 2, 3)
scatter(vref, passRateTotal);
title("Pass Rate vs VREF");
ylabel("Pass Rate");
xlabel("Voltage (V)");

subplot(2, 2, 4)
scatter(vcm, passRateTotal);
title("Pass Rate vs VCM")
ylabel("Pass Rate");
xlabel("Voltage (V)");

sgtitle("For All Solutions Regardless of Accuracy")

% Plot maximum and minumum TTS for all solutions
figure(25);
subplot(2, 2, 1);
scatter(vref, maxTotalTTS);
title("Max TTS vs VREF");
ylabel("Time (s)");
xlabel("Voltage (V)");

subplot(2, 2, 2);
scatter(vcm, maxTotalTTS);
title("Max TTS vs VCM");
ylabel("Time (s)");
xlabel("Voltage (V)");

subplot(2, 2, 3)
scatter(vref, minTotalTTS);
title("Min TTS vs VREF");
ylabel("Time (s)");
xlabel("Voltage (V)");

subplot(2, 2, 4)
scatter(vcm, minTotalTTS);
title("Min TTS vs VCM")
ylabel("Time (s)");
xlabel("Voltage (V)");

sgtitle("For All Solutions Regardless of Accuracy")

% Plot mean TTS and TTS standard deviation for 100% accurate solutions
figure(26);
subplot(2, 2, 1)
scatter(vref(passRateTotal==1), avgTotalTTS(passRateTotal==1));
title("Mean TTS vs VREF");
ylabel("Time (s)");
xlabel("Voltage (V)");

subplot(2, 2, 2)
scatter(vcm(passRateTotal==1), avgTotalTTS(passRateTotal==1));
title("Mean TTS vs VCM ");
ylabel("Time (s)");
xlabel("Voltage (V)");

subplot(2, 2, 3)
scatter(vref(passRateTotal==1), stdTotalTTS(passRateTotal==1));
title("Stdev TTS vs VREF")
ylabel("Time (s)");
xlabel("Voltage (V)");

subplot(2, 2, 4)
scatter(vcm(passRateTotal==1), stdTotalTTS(passRateTotal==1));
title("Stdev TTS vs VCM")
ylabel("Time (s)");
xlabel("Voltage (V)");

sgtitle("For 100% Accurate Solutions Only")

% Plot median TTS and pass rate for 100% accurate solutions
figure(27);
subplot(2, 2, 1);
scatter(vref(passRateTotal==1), medTotalTTS(passRateTotal==1));
title("Median TTS vs VREF");
ylabel("Time (s)");
xlabel("Voltage (V)");

subplot(2, 2, 2);
scatter(vcm(passRateTotal==1), medTotalTTS(passRateTotal==1));
title("Median TTS vs VCM");
ylabel("Time (s)");
xlabel("Voltage (V)");

subplot(2, 2, 3)
scatter(vref(passRateTotal==1), passRateTotal(passRateTotal==1));
title("Pass Rate vs VREF");
ylabel("Pass Rate");
xlabel("Voltage (V)");

subplot(2, 2, 4)
scatter(vcm(passRateTotal==1), passRateTotal(passRateTotal==1));
title("Pass Rate vs VCM")
ylabel("Pass Rate");
xlabel("Voltage (V)");

sgtitle("For 100% Accurate Solutions Only")

% Plot maximum and minumum TTS for 100% accurate solutions
figure(28);
subplot(2, 2, 1);
scatter(vref(passRateTotal==1), maxTotalTTS(passRateTotal==1));
title("Max TTS vs VREF");
ylabel("Time (s)");
xlabel("Voltage (V)");

subplot(2, 2, 2);
scatter(vcm(passRateTotal==1), maxTotalTTS(passRateTotal==1));
title("Max TTS vs VCM");
ylabel("Time (s)");
xlabel("Voltage (V)");

subplot(2, 2, 3)
scatter(vref(passRateTotal==1), minTotalTTS(passRateTotal==1));
title("Min TTS vs VREF");
ylabel("Time (s)");
xlabel("Voltage (V)");

subplot(2, 2, 4)
scatter(vcm(passRateTotal==1), minTotalTTS(passRateTotal==1));
title("Min TTS vs VCM")
ylabel("Time (s)");
xlabel("Voltage (V)");

sgtitle("For 100% Accurate Solutions Only")


%% Plot VDD Results

% Plot mean TTS and TTS standard deviation for all solutions
figure(29);
subplot(2, 1, 1);
scatter(vdd, avgTotalTTS);
title("Mean TTS vs VDD");
ylabel("Time (s)");
xlabel("Voltage (V)");

subplot(2, 1, 2)
scatter(vdd, stdTotalTTS);
title("Stdev TTS vs VDD");
ylabel("Time (s)");
xlabel("Voltage (V)");

sgtitle("For All Solutions Regardless of Accuracy")

% Plot median TTS and pass rate for all solutions
figure(30);
subplot(2, 1, 1);
scatter(vdd, medTotalTTS);
title("Median TTS vs VDD");
ylabel("Time (s)");
xlabel("Voltage (V)");

subplot(2, 1, 2)
scatter(vdd, passRateTotal);
title("Pass Rate vs VDD");
ylabel("Pass Rate");
xlabel("Voltage (V)");

sgtitle("For All Solutions Regardless of Accuracy")

% Plot maximum and minumum TTS for all solutions
figure(31);
subplot(2, 1, 1);
scatter(vdd, maxTotalTTS);
title("Max TTS vs VDD");
ylabel("Time (s)");
xlabel("Voltage (V)");

subplot(2, 1, 2)
scatter(vdd, minTotalTTS);
title("Min TTS vs VDD");
ylabel("Time (s)");
xlabel("Voltage (V)");

sgtitle("For All Solutions Regardless of Accuracy")

% Plot mean TTS and TTS standard deviation for 100% accurate solutions
figure(32);
subplot(2, 1, 1)
scatter(vdd(passRateTotal==1), avgTotalTTS(passRateTotal==1));
title("Mean TTS vs VDD");
ylabel("Time (s)");
xlabel("Voltage (V)");

subplot(2, 1, 2)
scatter(vdd(passRateTotal==1), stdTotalTTS(passRateTotal==1));
title("Stdev TTS vs VDD")
ylabel("Time (s)");
xlabel("Voltage (V)");

sgtitle("For 100% Accurate Solutions Only")

% Plot median TTS and pass rate for 100% accurate solutions
figure(33);
subplot(2, 1, 1);
scatter(vdd(passRateTotal==1), medTotalTTS(passRateTotal==1));
title("Median TTS vs VDD");
ylabel("Time (s)");
xlabel("Voltage (V)");

subplot(2, 1, 2)
scatter(vdd(passRateTotal==1), passRateTotal(passRateTotal==1));
title("Pass Rate vs VDD");
ylabel("Pass Rate");
xlabel("Voltage (V)");

sgtitle("For 100% Accurate Solutions Only")

% Plot maximum and minumum TTS for 100% accurate solutions
figure(34);
subplot(2, 1, 1);
scatter(vdd(passRateTotal==1), maxTotalTTS(passRateTotal==1));
title("Max TTS vs VDD");
ylabel("Time (s)");
xlabel("Voltage (V)");

subplot(2, 1, 2)
scatter(vdd(passRateTotal==1), minTotalTTS(passRateTotal==1));
title("Min TTS vs VDD");
ylabel("Time (s)");
xlabel("Voltage (V)");

sgtitle("For 100% Accurate Solutions Only")