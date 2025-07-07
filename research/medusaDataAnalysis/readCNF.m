function [numVar, numCls, clauses] = readCNF(filename)
  
  % Read in full cnf file including header
  cnf = readmatrix(filename, 'FileType', 'text', 'NumHeaderLines', 0, 'Delimiter', " ", 'OutputType', 'string');

  maxK = 200;   % Maximum number of variables per clause

  deleteList = false(size(cnf, 1), 1);

  for i = 1:size(cnf, 1)
    if cnf(i, 1) == 'c'
       deleteList(i) = true;
    end
  end

  cnf(deleteList, :) = [];

  % Find and extract header information
  [row, ~] = find(cnf == 'p');      % Find hezader row
  numVar = str2double(cnf(row, 3)); % Extract number of variables from header
  numCls = str2double(cnf(row, 5)); % Extract number of clauses from header
  
  clauses = zeros(numCls, maxK+1);  % allocate array for clause data

  for i = 1:numCls
    if ismissing(cnf(row+i, 1))
      cnf(row+i, 1:size(cnf, 2)-1) = cnf(row+i, 2:size(cnf, 2));
    end
  end

  % For all clauses copy information to array
  for i = 1:numCls
    
    cnt = 1;
    var = str2double(cnf(row+i, cnt));
    
    while var ~= 0
        clauses(i, cnt) = var;
        cnt = cnt + 1;
        var = str2double(cnf(row+i, cnt));
    end
  end
end

