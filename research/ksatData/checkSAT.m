% Project: Data processing for k-SAT chip
% Authors: Luke Wormald

function [pass, clsUnsat, dout] = checkSAT(clauses, result)
  % tic;
  % Convert results to binary string
  result = flip(dec2bin(result, 32), 2);

  dout = zeros(200, 1);
  clsSat = zeros(size(clauses, 1), 1);

  % For all oscillators
  for i = 0:199
    % Determine results indexing
    row = floor(i/32) + 1;
    col = mod(i, 32) + 1;
  
    % Order RXO values into array
    dout(i+1) = str2double(result(row, col));
  end

  % For all clauses
  for cls = 1:size(clauses, 1)
      clsEnd = find(clauses(cls,:)==0)-1;
      RXOs = clauses(cls, 1:clsEnd(1));
      states = logical(dout(abs(RXOs))).';
      signs = RXOs > 0;
      
      if ~all(bitxor(states, signs))
        clsSat(cls) = 1;
      end
  end

  if all(clsSat)
    pass = 1;
  else
    pass = 0;
  end

  clsUnsat = size(clauses, 1) - sum(clsSat);
  % toc;
end