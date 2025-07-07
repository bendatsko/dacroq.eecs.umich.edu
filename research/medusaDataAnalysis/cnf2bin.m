% Project: Convert .cnf file to .bin file
% Authors: Luke Wormald

clear;

% Set path to batch of problems being run and get file names
batch_path = 'tentative_batches/projected/t_batch_3/';
% batch_path = 'satlib/uf75-325/';
files = struct2table(dir(strcat('CNF_Files/', batch_path))).name;
files(1:2) = [];

% Preallocate file path array
file_paths = strings(length(files), 1);

% Concatonate all file paths
for i = 1:length(files)
  file_paths(i) = strcat('CNF_Files/', batch_path, files{i});
end

% For each file
for i = 1:length(file_paths)
    [numVar, numCls, clauses] = readCNF(file_paths(i));

    fileID = fopen(strcat('BIN_Files/', batch_path, files{i}, '.bin'), "w");
    fwrite(fileID, numVar, "int16");
    fwrite(fileID, numCls, "int16");

    for j=1:numCls
      cnt = 1;
      var = clauses(j, cnt);

      while var ~= 0
        fwrite(fileID, var, "int16");
        cnt = cnt + 1;
        var = clauses(j, cnt);
      end

      fwrite(fileID, 0, "int16");
    end

    fclose(fileID);
end

