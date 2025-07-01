function export2CSV(filename)
% export2CSV - Export all numeric workspace variables to a CSV file
% Usage: export2CSV('filename.csv')
% 
% This function exports all numeric variables from the base workspace
% to a CSV file, properly handling vectors of different lengths by
% padding with NaN values.

    if nargin < 1
        filename = 'workspace_data.csv';
    end
    
    % Get all variables in the base workspace
    vars = evalin('base', 'whos');
    
    % Initialize containers
    tableData = [];
    varNames = {};
    
    % Find the maximum length and collect valid variables
    maxLength = 0;
    validVars = {};
    
    % First pass: collect valid numeric variables and find max length
    for i = 1:length(vars)
        varName = vars(i).name;
        
        % Skip if variable name starts with underscore (internal)
        if startsWith(varName, '_')
            continue;
        end
        
        try
            varValue = evalin('base', varName);
            
            % Check if the variable is numeric and not empty
            if isnumeric(varValue) && ~isempty(varValue)
                % Convert to column vector
                varValue = varValue(:);
                validVars{end+1} = {varName, varValue};
                maxLength = max(maxLength, length(varValue));
            end
        catch
            % Skip variables that can't be evaluated
            continue;
        end
    end
    
    % Second pass: create padded columns
    for i = 1:length(validVars)
        varName = validVars{i}{1};
        varValue = validVars{i}{2};
        
        % Pad with NaN if shorter than maxLength
        if length(varValue) < maxLength
            varValue = [varValue; NaN(maxLength - length(varValue), 1)];
        end
        
        tableData = [tableData, varValue];
        varNames{end+1} = varName;
    end
    
    % Create and save table
    if ~isempty(tableData)
        dataTable = array2table(tableData, 'VariableNames', varNames);
        
        % Save to CSV
        writetable(dataTable, filename);
        
        % Display summary
        fprintf('Successfully exported %d variables with %d data points each to %s\n', ...
            length(varNames), maxLength, filename);
        fprintf('Variables exported: %s\n', strjoin(varNames, ', '));
    else
        warning('No numeric variables found to export');
    end
end