% Project: Data processing for k-SAT chip
% Authors: Luke Wormald

% Path to results files
results_path = strcat('/Volumes/NO NAME 1/BIN_Files/', batch_path);

% Read in result file names
resultList = string(struct2table(dir(results_path + "/*_*.results")).name);
resultList = natsortfiles(resultList);

% Format for string conversion
formatSpec = '_%.2f';


%% Run search loop

numPoints = 0;

for vdd = 0.9:.1:.9
  for vcm = 0.55:0.05:0.55
    for vref = 0.5:.1:0.5
      for itia = 50:10:.60
        for ibldn = 6:1:10
          for ibreak = 15:1:25
            for imake = 100:10:150
              for ibldp = 6:1:ibldn
                for icmp = 25:5:25
                  numPoints = numPoints + 1;
                end
              end
            end
          end
        end
      end
    end
  end
end

counts = zeros(1, numPoints);

idx = 1;

for vdd = 0.9:.1:.9
  for vcm = 0.55:0.05:0.55
    for vref = 0.5:.1:0.5
      for itia = 50:10:60
        for ibldn = 6:1:10
          for ibreak = 15:1:25
            for imake = 100:10:150
              for ibldp = 6:1:ibldn
                for icmp = 25:5:25
                  voltPoint = strcat(num2str(vdd, formatSpec), num2str(vcm, formatSpec), num2str(vref, formatSpec));
                  bias1Point = strcat(num2str(itia, formatSpec), num2str(ibldn, formatSpec), num2str(ibreak, formatSpec));
                  bias2Point = strcat(num2str(imake, formatSpec), num2str(ibldp, formatSpec), num2str(icmp, formatSpec));
                  opPoint = strcat(voltPoint, bias1Point, bias2Point);

                  counts(idx) = sum(contains(resultList, opPoint));

                  if (counts(idx) < 100 && counts(idx) > 0)
                    disp(opPoint);
                    disp(counts(idx));
                  end

                  idx = idx + 1;
                end
              end
            end
          end
        end
      end
    end
  end
end