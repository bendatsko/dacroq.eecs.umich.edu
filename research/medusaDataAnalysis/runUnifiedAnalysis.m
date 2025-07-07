function runUnifiedAnalysis(csvFile, varargin)
% runUnifiedAnalysis - Complete analysis pipeline for k-SAT chip optimization
% 
% Usage:
%   runUnifiedAnalysis('workspace_data.csv') - Basic analysis
%   runUnifiedAnalysis('workspace_data.csv', 'SaveFigs', true) - Save all figures
%   runUnifiedAnalysis('workspace_data.csv', 'TargetPassRate', 0.98) - Set accuracy threshold
%
% This function combines all analysis capabilities into a single pipeline:
% - Data loading and cleaning
% - Statistical analysis
% - Parameter space exploration
% - Optimal point identification
% - Insights extraction
% - Report generation

    % Parse optional inputs
    p = inputParser;
    addParameter(p, 'SaveFigs', true, @islogical);
    addParameter(p, 'TargetPassRate', 0.95, @isnumeric);
    addParameter(p, 'FigurePrefix', 'ksat_analysis', @ischar);
    addParameter(p, 'RunInsights', true, @islogical);
    parse(p, varargin{:});
    
    saveFigs = p.Results.SaveFigs;
    targetPassRate = p.Results.TargetPassRate;
    figPrefix = p.Results.FigurePrefix;
    runInsights = p.Results.RunInsights;
    
    % Create output directory
    if saveFigs
        if ~exist('analysis_outputs', 'dir')
            mkdir('analysis_outputs');
        end
        figPrefix = fullfile('analysis_outputs', figPrefix);
    end
    
    %% Step 1: Load and Clean Data
    fprintf('=== STEP 1: LOADING AND CLEANING DATA ===\n');
    
    if nargin < 1 || isempty(csvFile)
        csvFile = 'workspace_data.csv';
    end
    
    % Check if file exists
    if ~exist(csvFile, 'file')
        error('CSV file not found: %s\nPlease run export2CSV first.', csvFile);
    end
    
    % Load data
    data = readtable(csvFile);
    fprintf('Loaded %d rows with %d variables\n', height(data), width(data));
    
    % Memory usage warning for large datasets
    if height(data) > 100000
        fprintf('WARNING: Large dataset detected (%d rows).\n', height(data));
        fprintf('Some analyses will use sampling to prevent memory issues.\n');
        fprintf('Consider reducing dataset size if full analysis is needed.\n\n');
    end
    
    % Clean the data - remove rows with all NaN values
    rowsWithData = any(~isnan(table2array(data)), 2);
    data = data(rowsWithData, :);
    fprintf('After cleaning: %d valid rows\n', height(data));
    
    % Calculate derived metrics if not present
    if ismember('avgTTS', data.Properties.VariableNames) && ismember('power', data.Properties.VariableNames)
        % Check if we need to calculate ETS
        if ~ismember('ETS', data.Properties.VariableNames)
            % Check data dimensions
            avgTTSCount = sum(~isnan(data.avgTTS));
            powerCount = sum(~isnan(data.power));
            
            if avgTTSCount == height(data) && powerCount == height(data)
                % Both have full data, can calculate ETS
                data.ETS = data.avgTTS .* data.power;
                fprintf('Calculated ETS (Energy to Solution)\n');
            else
                % Try to match dimensions if possible
                fprintf('Note: avgTTS has %d values, power has %d values\n', avgTTSCount, powerCount);
                
                % If power is a single value or small array, try to expand it
                uniquePower = unique(data.power(~isnan(data.power)));
                if length(uniquePower) == 1
                    % Single power value for all experiments
                    data.ETS = data.avgTTS * uniquePower;
                    fprintf('Calculated ETS using constant power value: %.6f W\n', uniquePower);
                elseif powerCount < height(data) * 0.1
                    % Power seems to be a summary statistic, skip ETS calculation
                    fprintf('Skipping ETS calculation due to dimension mismatch\n');
                end
            end
        end
    elseif ismember('TTS', data.Properties.VariableNames) && ismember('power', data.Properties.VariableNames)
        % Use TTS instead of avgTTS if available
        if ~ismember('ETS', data.Properties.VariableNames)
            ttsCount = sum(~isnan(data.TTS));
            powerCount = sum(~isnan(data.power));
            
            if ttsCount < height(data) * 0.1 && powerCount < height(data) * 0.1
                fprintf('Note: TTS and power appear to be summary statistics (only %d and %d values)\n', ...
                    ttsCount, powerCount);
            end
        end
    end
    
    % Report on data quality
    fprintf('\nData Quality Report:\n');
    fprintf('-------------------\n');
    
    % Check for sparse columns
    for i = 1:width(data)
        colName = data.Properties.VariableNames{i};
        nonNaN = sum(~isnan(data{:,i}));
        if nonNaN < height(data) * 0.1  % Less than 10% populated
            fprintf('WARNING: %s has only %d non-NaN values (%.1f%%)\n', ...
                colName, nonNaN, nonNaN/height(data)*100);
        end
    end
    
    if ismember('avgTTS', data.Properties.VariableNames)
        zeroTTS = sum(data.avgTTS == 0);
        if zeroTTS > 0
            fprintf('Note: Found %d entries with zero avgTTS (%.1f%%)\n', zeroTTS, zeroTTS/height(data)*100);
        end
        
        % Check for valid TTS range
        validTTS = data.avgTTS > 0 & ~isnan(data.avgTTS);
        fprintf('Valid avgTTS entries: %d (%.1f%%)\n', sum(validTTS), sum(validTTS)/height(data)*100);
    end
    
    fprintf('-------------------\n');
    
    %% Step 2: Identify Parameters and Metrics
    fprintf('\n=== STEP 2: IDENTIFYING PARAMETERS AND METRICS ===\n');
    
    % Identify operating parameters
    opParams = {'vdd', 'vcm', 'vref', 'i_tia', 'i_bld_n', 'i_bld_p', 'i_break', 'i_make', 'i_cmp'};
    altParams = {'vdd', 'vcm', 'vref', 'itia', 'ibldn', 'ibldp', 'ibreak', 'imake', 'icmp'};
    
    existingParams = {};
    paramMapping = containers.Map();
    
    for i = 1:length(opParams)
        if ismember(opParams{i}, data.Properties.VariableNames)
            existingParams{end+1} = opParams{i};
            paramMapping(opParams{i}) = opParams{i};
        elseif ismember(altParams{i}, data.Properties.VariableNames)
            existingParams{end+1} = altParams{i};
            paramMapping(altParams{i}) = opParams{i}; % Map to standard name
        end
    end
    
    fprintf('Found %d operating parameters: %s\n', length(existingParams), strjoin(existingParams, ', '));
    
    % Check for key performance metrics
    keyMetrics = {'TTS', 'avgTTS', 'power', 'passRate', 'numPass', 'numRuns', 'ETS', 'stdTTS'};
    hasMetrics = ismember(keyMetrics, data.Properties.VariableNames);
    existingMetrics = keyMetrics(hasMetrics);
    
    fprintf('Found performance metrics: %s\n', strjoin(existingMetrics, ', '));
    
    %% Step 3: Basic Statistics
    fprintf('\n=== STEP 3: BASIC STATISTICS ===\n');
    
    % Calculate statistics for numeric columns
    numericCols = varfun(@isnumeric, data, 'OutputFormat', 'uniform');
    numericData = data(:, numericCols);
    
    summaryStats = table();
    for i = 1:width(numericData)
        varName = numericData.Properties.VariableNames{i};
        varData = numericData{:, i};
        validData = varData(~isnan(varData));
        
        if ~isempty(validData)
            summaryStats.(varName) = [
                mean(validData);
                std(validData);
                median(validData);
                min(validData);
                max(validData);
                sum(~isnan(varData))
            ];
        end
    end
    summaryStats.Properties.RowNames = {'Mean', 'Std', 'Median', 'Min', 'Max', 'Count'};
    
    % Display key statistics
    fprintf('\nKey Performance Metrics:\n');
    metricsToShow = intersect(existingMetrics, summaryStats.Properties.VariableNames);
    if ~isempty(metricsToShow)
        disp(summaryStats(:, metricsToShow));
    end
    
    % Save statistics
    writetable(summaryStats, fullfile('analysis_outputs', 'summary_statistics.csv'), 'WriteRowNames', true);
    
    %% Step 4: Find Optimal Operating Points
    fprintf('\n=== STEP 4: FINDING OPTIMAL OPERATING POINTS ===\n');
    
    optimalPoints = findOptimalPoints(data, existingParams, targetPassRate);
    
    if ~isempty(optimalPoints)
        % Convert struct to table for saving
        optimalFields = fieldnames(optimalPoints);
        optimalValues = cell(length(optimalFields), 1);
        for i = 1:length(optimalFields)
            optimalValues{i} = optimalPoints.(optimalFields{i});
        end
        optimalTable = table(optimalValues, 'RowNames', optimalFields, 'VariableNames', {'Value'});
        
        writetable(optimalTable, fullfile('analysis_outputs', 'optimal_operating_points.csv'), 'WriteRowNames', true);
        
        % Create testbench configuration
        createTestbenchConfig(optimalPoints, existingParams);
    end
    
    %% Step 5: Create Single Comprehensive Dashboard
    fprintf('\n=== STEP 5: CREATING SINGLE COMPREHENSIVE DASHBOARD ===\n');
    
    % Close any existing figures to ensure only one window
    close all;
    
    % Create the single master dashboard
    createMasterDashboard(data, existingParams, existingMetrics, optimalPoints, targetPassRate, saveFigs, figPrefix);
    
    %% Step 6: Extract Insights
    if runInsights
        fprintf('\n=== STEP 6: EXTRACTING INSIGHTS ===\n');
        insights = extractInsights(data, existingParams, targetPassRate);
        save(fullfile('analysis_outputs', 'analysis_insights.mat'), 'insights');
    end
    
    %% Step 7: Generate Summary Report
    fprintf('\n=== STEP 7: GENERATING SUMMARY REPORT ===\n');
    
    generateReport(data, existingParams, existingMetrics, optimalPoints, insights, targetPassRate);
    
    fprintf('\n=== ANALYSIS COMPLETE ===\n');
    fprintf('All results saved to: analysis_outputs/\n');
end

%% Main Dashboard Function - Single Window with All Telemetry

function createMasterDashboard(data, existingParams, existingMetrics, optimalPoints, targetPassRate, saveFigs, figPrefix)
    % Create ONE comprehensive dashboard with all chip telemetry and performance data
    
    % Sample data if too large
    if height(data) > 20000
        fprintf('Sampling %d points from %d total for visualization\n', 20000, height(data));
        sampleIdx = randperm(height(data), 20000);
        dataViz = data(sampleIdx, :);
    else
        dataViz = data;
    end
    
    % Create single figure with 16:9 aspect ratio
    figure('Name', 'k-SAT Chip Master Dashboard', 'Position', [50, 50, 1600, 900], ...
           'NumberTitle', 'off', 'Color', [0.95 0.95 0.95]);
    
    % Define layout: 6 rows x 6 columns = 36 tiles (added one row for better text display)
    rows = 6;
    cols = 6;
    
    %% Row 1: Performance Distributions (tiles 1-6)
    
    % Tile 1-2: TTS Distribution with statistics
    subplot(rows, cols, [1 2]);
    if ismember('avgTTS', dataViz.Properties.VariableNames)
        validTTS = dataViz.avgTTS(dataViz.avgTTS > 0);
        if ~isempty(validTTS)
            histogram(log10(validTTS), 50, 'Normalization', 'probability', ...
                     'FaceColor', [0.2, 0.6, 0.8], 'EdgeColor', 'none');
            xlabel('log_{10}(TTS) [seconds]', 'FontSize', 10);
            ylabel('Probability', 'FontSize', 10);
            title('Time to Solution Distribution', 'FontSize', 11, 'FontWeight', 'bold');
            
            % Add statistics text
            text(0.98, 0.95, sprintf('Mean: %.3e s\nMedian: %.3e s\nStd: %.3e s', ...
                mean(validTTS), median(validTTS), std(validTTS)), ...
                'Units', 'normalized', 'FontSize', 9, 'HorizontalAlignment', 'right', ...
                'VerticalAlignment', 'top', 'BackgroundColor', [1 1 1 0.8]);
        end
    end
    grid on; set(gca, 'FontSize', 9);
    
    % Tile 3-4: Pass Rate Distribution
    subplot(rows, cols, [3 4]);
    if ismember('passRate', dataViz.Properties.VariableNames)
        histogram(dataViz.passRate * 100, 20, 'FaceColor', [0.2, 0.8, 0.2], 'EdgeColor', 'none');
        xlabel('Pass Rate (%)', 'FontSize', 10);
        ylabel('Count', 'FontSize', 10);
        title('Accuracy Distribution', 'FontSize', 11, 'FontWeight', 'bold');
        
        % Add threshold line
        hold on;
        xline(targetPassRate * 100, 'r--', 'LineWidth', 2, 'Label', sprintf('Target: %.0f%%', targetPassRate*100));
        hold off;
        
        % Add statistics
        text(0.02, 0.95, sprintf('Mean: %.1f%%\n>%.0f%%: %d (%.1f%%)', ...
            mean(dataViz.passRate)*100, targetPassRate*100, ...
            sum(dataViz.passRate > targetPassRate), ...
            sum(dataViz.passRate > targetPassRate)/height(dataViz)*100), ...
            'Units', 'normalized', 'FontSize', 9, 'HorizontalAlignment', 'left', ...
            'VerticalAlignment', 'top', 'BackgroundColor', [1 1 1 0.8]);
    end
    grid on; set(gca, 'FontSize', 9);
    
    % Tile 5-6: Power/Energy Distribution
    subplot(rows, cols, [5 6]);
    if ismember('power', dataViz.Properties.VariableNames)
        validPower = dataViz.power(~isnan(dataViz.power));
        if length(unique(validPower)) > 1
            histogram(validPower * 1000, 30, 'FaceColor', [0.8, 0.2, 0.2], 'EdgeColor', 'none');
            xlabel('Power (mW)', 'FontSize', 10);
        else
            % Single power value - show as bar
            bar(1, unique(validPower) * 1000, 'FaceColor', [0.8, 0.2, 0.2]);
            xlabel('Power (mW)', 'FontSize', 10);
            xlim([0 2]);
        end
        ylabel('Count', 'FontSize', 10);
        title('Power Consumption', 'FontSize', 11, 'FontWeight', 'bold');
        
        % Add statistics
        text(0.98, 0.95, sprintf('Mean: %.2f mW\nRange: [%.2f, %.2f] mW', ...
            mean(validPower)*1000, min(validPower)*1000, max(validPower)*1000), ...
            'Units', 'normalized', 'FontSize', 9, 'HorizontalAlignment', 'right', ...
            'VerticalAlignment', 'top', 'BackgroundColor', [1 1 1 0.8]);
    end
    grid on; set(gca, 'FontSize', 9);
    
    %% Row 2: Parameter Sensitivity Analysis (tiles 7-12)
    
    nParams = length(existingParams);
    for i = 1:min(6, nParams)
        subplot(rows, cols, 6 + i);
        
        if ismember('avgTTS', dataViz.Properties.VariableNames) && ismember('passRate', dataViz.Properties.VariableNames)
            % Get parameter data
            paramData = dataViz.(existingParams{i});
            uniqueVals = unique(paramData(~isnan(paramData)));
            
            if length(uniqueVals) > 1
                % Variable parameter - scatter plot
                scatter(paramData, dataViz.avgTTS, ...
                    20, dataViz.passRate * 100, 'filled', 'MarkerFaceAlpha', 0.6);
                
                % Add trend line for high accuracy points
                highAccIdx = dataViz.passRate >= targetPassRate;
                if sum(highAccIdx) > 10
                    hold on;
                    xFit = [min(paramData) max(paramData)];
                    p = polyfit(paramData(highAccIdx), dataViz.avgTTS(highAccIdx), 1);
                    yFit = polyval(p, xFit);
                    plot(xFit, yFit, 'r-', 'LineWidth', 2);
                    hold off;
                end
                
                colorbar;
                c = colorbar;
                c.Label.String = 'Pass Rate (%)';
                c.Label.FontSize = 8;
            else
                % Constant parameter - show histogram of TTS
                histogram(dataViz.avgTTS, 20, 'FaceColor', [0.5 0.5 0.5]);
                title(sprintf('%s = %.3f (const)', upper(existingParams{i}), uniqueVals), ...
                     'FontSize', 10, 'FontWeight', 'bold');
            end
            
            xlabel(strrep(existingParams{i}, '_', ' '), 'FontSize', 9);
            ylabel('TTS (s)', 'FontSize', 9);
            if length(uniqueVals) > 1
                title(upper(existingParams{i}), 'FontSize', 10, 'FontWeight', 'bold');
            end
            grid on;
            set(gca, 'FontSize', 8);
        end
    end
    
    %% Row 3: Main Performance Analysis (tiles 13-18)
    
    % Tiles 13-15: Performance vs Accuracy Trade-off (large plot)
    subplot(rows, cols, [13 14 15]);
    if ismember('avgTTS', dataViz.Properties.VariableNames) && ismember('passRate', dataViz.Properties.VariableNames)
        % Create 2D histogram for dense data
        if height(dataViz) > 5000
            % Use 2D binning for density
            [N, xedges, yedges] = histcounts2(dataViz.passRate * 100, log10(dataViz.avgTTS(dataViz.avgTTS > 0)), 50);
            imagesc(xedges(1:end-1), yedges(1:end-1), N');
            set(gca, 'YDir', 'normal');
            colormap(flipud(hot));
            c = colorbar;
            c.Label.String = 'Count';
        else
            scatter(dataViz.passRate * 100, dataViz.avgTTS, ...
                   40, 'filled', 'MarkerFaceAlpha', 0.6);
            set(gca, 'YScale', 'log');
        end
        
        xlabel('Pass Rate (%)', 'FontSize', 11);
        ylabel('Time to Solution (s)', 'FontSize', 11);
        title('Performance vs Accuracy Trade-off', 'FontSize', 12, 'FontWeight', 'bold');
        
        % Add target line
        hold on;
        xline(targetPassRate * 100, 'g--', 'LineWidth', 2);
        
        % Highlight optimal points if available
        if ~isempty(optimalPoints) && isfield(optimalPoints, 'Balanced_PassRate')
            plot(optimalPoints.Balanced_PassRate * 100, optimalPoints.Balanced_TTS, ...
                'r*', 'MarkerSize', 15, 'LineWidth', 2);
            text(optimalPoints.Balanced_PassRate * 100 + 1, optimalPoints.Balanced_TTS, ...
                'Optimal', 'FontSize', 9, 'Color', 'red', 'FontWeight', 'bold');
        end
        hold off;
        
        grid on;
        set(gca, 'FontSize', 10);
    end
    
    % Tiles 16-18: 3D Parameter Space or Pareto Front
    subplot(rows, cols, [16 17 18]);
    if length(existingParams) >= 3 && ismember('avgTTS', dataViz.Properties.VariableNames)
        % Find parameters with variation
        paramVariance = zeros(length(existingParams), 1);
        for i = 1:length(existingParams)
            uniqueVals = unique(dataViz.(existingParams{i})(~isnan(dataViz.(existingParams{i}))));
            if length(uniqueVals) > 1
                paramVariance(i) = var(dataViz.(existingParams{i}));
            end
        end
        [~, sortIdx] = sort(paramVariance, 'descend');
        topParams = existingParams(sortIdx(1:min(3, sum(paramVariance > 0))));
        
        if length(topParams) >= 3
            scatter3(dataViz.(topParams{1}), dataViz.(topParams{2}), dataViz.(topParams{3}), ...
                    25, log10(dataViz.avgTTS), 'filled', 'MarkerFaceAlpha', 0.6);
            xlabel(strrep(topParams{1}, '_', ' '), 'FontSize', 9);
            ylabel(strrep(topParams{2}, '_', ' '), 'FontSize', 9);
            zlabel(strrep(topParams{3}, '_', ' '), 'FontSize', 9);
            title('3D Parameter Space', 'FontSize', 11, 'FontWeight', 'bold');
            colorbar;
            c = colorbar;
            c.Label.String = 'log_{10}(TTS)';
            c.Label.FontSize = 8;
            view(45, 30);
            grid on;
        else
            % Not enough varying parameters - show Pareto front instead
            if ismember('ETS', dataViz.Properties.VariableNames)
                createParetoPlot(dataViz, targetPassRate);
            else
                text(0.5, 0.5, 'Insufficient parameter variation for 3D plot', ...
                    'HorizontalAlignment', 'center', 'FontSize', 11);
            end
        end
    end
    set(gca, 'FontSize', 9);
    
    %% Row 4: Time Series and Correlations (tiles 19-24)
    
    % Tiles 19-21: Performance Trends Over Experiments
    subplot(rows, cols, [19 20 21]);
    if ismember('avgTTS', dataViz.Properties.VariableNames)
        if height(dataViz) > 1000
            % Use moving average for large datasets
            windowSize = max(10, floor(height(dataViz)/100));
            movingAvgTTS = movmean(dataViz.avgTTS, windowSize, 'omitnan');
            plot(1:height(dataViz), movingAvgTTS, 'b-', 'LineWidth', 1.5);
            ylabel('TTS (s) - Moving Avg', 'FontSize', 10);
        else
            plot(1:height(dataViz), dataViz.avgTTS, 'b-', 'LineWidth', 1);
            ylabel('TTS (s)', 'FontSize', 10);
        end
        
        if ismember('passRate', dataViz.Properties.VariableNames)
            yyaxis right;
            if height(dataViz) > 1000
                windowSize = max(10, floor(height(dataViz)/100));
                movingAvgPass = movmean(dataViz.passRate, windowSize, 'omitnan') * 100;
                plot(1:height(dataViz), movingAvgPass, 'r-', 'LineWidth', 1.5);
            else
                plot(1:height(dataViz), dataViz.passRate * 100, 'r-', 'LineWidth', 1);
            end
            ylabel('Pass Rate (%)', 'FontSize', 10);
            ylim([0 105]);
        end
        
        xlabel('Experiment Index', 'FontSize', 10);
        title('Performance Trends', 'FontSize', 11, 'FontWeight', 'bold');
        grid on;
        legend('TTS', 'Pass Rate', 'Location', 'best', 'FontSize', 8);
        set(gca, 'FontSize', 9);
    end
    
    % Tiles 22-24: Parameter Importance or Correlation Matrix
    subplot(rows, cols, [22 23 24]);
    if ismember('avgTTS', data.Properties.VariableNames) && length(existingParams) > 0
        % Calculate correlations with full dataset (not sampled)
        importance = calculateParameterImportance(data, existingParams);
        
        if ~isempty(importance) && height(importance) > 0
            bar(categorical(importance.Parameter), importance.Score, 'FaceColor', [0.2, 0.6, 0.8]);
            xlabel('Parameter', 'FontSize', 10);
            ylabel('Importance Score', 'FontSize', 10);
            title('Parameter Importance Ranking', 'FontSize', 11, 'FontWeight', 'bold');
            xtickangle(45);
            grid on;
            
            % Add correlation values as text
            for i = 1:height(importance)
                if ~isnan(importance.Score(i))
                    text(i, importance.Score(i), sprintf('%.2f', importance.CorrWithTTS(i)), ...
                        'HorizontalAlignment', 'center', 'VerticalAlignment', 'bottom', ...
                        'FontSize', 8);
                end
            end
        else
            text(0.5, 0.5, 'Unable to calculate parameter importance', ...
                'HorizontalAlignment', 'center', 'FontSize', 11);
        end
    end
    set(gca, 'FontSize', 9);
    
    %% Rows 5-6: Summary Statistics and Text Information (tiles 25-36)
    % Use two full rows for text information
    subplot(rows, cols, 25:36);
    axis off;
    
    % Add title banner
    rectangle('Position', [0 0.85 1 0.15], 'FaceColor', [0.9 0.9 0.95], ...
              'EdgeColor', [0.5 0.5 0.7], 'LineWidth', 2);
    text(0.5, 0.925, 'k-SAT CHIP OPTIMIZATION SUMMARY', ...
        'FontSize', 14, 'FontWeight', 'bold', 'HorizontalAlignment', 'center', ...
        'Color', [0.1 0.1 0.5]);
    
    % Create three column layout for summary information
    col1_x = 0.05;
    col2_x = 0.37;
    col3_x = 0.68;
    start_y = 0.78;
    line_spacing = 0.055;
    
    % Column 1: Dataset Overview
    text(col1_x, start_y, 'DATASET OVERVIEW', 'FontSize', 12, 'FontWeight', 'bold', ...
        'VerticalAlignment', 'top', 'Color', [0 0 0.6]);
    y_pos = start_y - line_spacing*1.2;
    
    % Draw underline
    line([col1_x col1_x+0.25], [y_pos+0.02 y_pos+0.02], 'Color', [0 0 0.6], 'LineWidth', 1.5);
    
    text(col1_x, y_pos, sprintf('Total Experiments: %s', addCommas(height(data))), ...
        'FontSize', 10, 'VerticalAlignment', 'top');
    y_pos = y_pos - line_spacing;
    
    text(col1_x, y_pos, sprintf('Operating Parameters: %d', length(existingParams)), ...
        'FontSize', 10, 'VerticalAlignment', 'top');
    y_pos = y_pos - line_spacing*0.8;
    
    % List parameters
    for i = 1:min(5, length(existingParams))
        text(col1_x + 0.02, y_pos, sprintf('• %s', upper(existingParams{i})), ...
            'FontSize', 9, 'VerticalAlignment', 'top', 'Interpreter', 'none', ...
            'Color', [0.3 0.3 0.3]);
        y_pos = y_pos - line_spacing*0.7;
    end
    if length(existingParams) > 5
        text(col1_x + 0.02, y_pos, sprintf('... and %d more', length(existingParams)-5), ...
            'FontSize', 9, 'VerticalAlignment', 'top', 'FontAngle', 'italic', ...
            'Color', [0.5 0.5 0.5]);
    end
    
    y_pos = y_pos - line_spacing*0.5;
    text(col1_x, y_pos, sprintf('Performance Metrics: %d', length(existingMetrics)), ...
        'FontSize', 10, 'VerticalAlignment', 'top');
    
    % Column 2: Performance Statistics
    if ismember('avgTTS', data.Properties.VariableNames) && ismember('passRate', data.Properties.VariableNames)
        text(col2_x, start_y, 'PERFORMANCE STATISTICS', 'FontSize', 12, 'FontWeight', 'bold', ...
            'VerticalAlignment', 'top', 'Color', [0 0.5 0]);
        y_pos = start_y - line_spacing*1.2;
        
        % Draw underline
        line([col2_x col2_x+0.25], [y_pos+0.02 y_pos+0.02], 'Color', [0 0.5 0], 'LineWidth', 1.5);
        
        validTTS = data.avgTTS(data.avgTTS > 0);
        if ~isempty(validTTS)
            text(col2_x, y_pos, 'Time to Solution (TTS):', ...
                'FontSize', 10, 'FontWeight', 'bold', 'VerticalAlignment', 'top');
            y_pos = y_pos - line_spacing*0.8;
            
            text(col2_x + 0.02, y_pos, sprintf('Range: %.2e - %.2e s', min(validTTS), max(validTTS)), ...
                'FontSize', 9, 'VerticalAlignment', 'top', 'Color', [0.3 0.3 0.3]);
            y_pos = y_pos - line_spacing*0.7;
            
            text(col2_x + 0.02, y_pos, sprintf('Mean: %.2e s', mean(validTTS)), ...
                'FontSize', 9, 'VerticalAlignment', 'top', 'Color', [0.3 0.3 0.3]);
            y_pos = y_pos - line_spacing*0.7;
            
            text(col2_x + 0.02, y_pos, sprintf('Median: %.2e s', median(validTTS)), ...
                'FontSize', 9, 'VerticalAlignment', 'top', 'Color', [0.3 0.3 0.3]);
            y_pos = y_pos - line_spacing;
        end
        
        text(col2_x, y_pos, 'Pass Rate:', ...
            'FontSize', 10, 'FontWeight', 'bold', 'VerticalAlignment', 'top');
        y_pos = y_pos - line_spacing*0.8;
        
        text(col2_x + 0.02, y_pos, sprintf('Best: %.1f%%', max(data.passRate) * 100), ...
            'FontSize', 9, 'VerticalAlignment', 'top', 'Color', [0.3 0.3 0.3]);
        y_pos = y_pos - line_spacing*0.7;
        
        highAccIdx = data.passRate > targetPassRate;
        if any(highAccIdx) && ~isempty(validTTS)
            highAccTTS = data.avgTTS(highAccIdx & data.avgTTS > 0);
            if ~isempty(highAccTTS)
                text(col2_x + 0.02, y_pos, sprintf('Best TTS (>%.0f%%): %.2e s', ...
                    targetPassRate*100, min(highAccTTS)), ...
                    'FontSize', 9, 'VerticalAlignment', 'top', 'Color', [0 0.5 0], ...
                    'FontWeight', 'bold');
                y_pos = y_pos - line_spacing*0.7;
            end
            
            text(col2_x + 0.02, y_pos, sprintf('High Acc. Points: %s (%.1f%%)', ...
                addCommas(sum(highAccIdx)), sum(highAccIdx)/height(data)*100), ...
                'FontSize', 9, 'VerticalAlignment', 'top', 'Color', [0.3 0.3 0.3]);
        end
    end
    
    % Column 3: Optimal Configurations (Multiple Modes)
    if ~isempty(optimalPoints)
        text(col3_x, start_y, 'OPTIMAL CONFIGURATIONS', 'FontSize', 12, 'FontWeight', 'bold', ...
            'VerticalAlignment', 'top', 'Color', [0.8 0 0]);
        y_pos = start_y - line_spacing*1.2;
        
        % Draw underline
        line([col3_x col3_x+0.25], [y_pos+0.02 y_pos+0.02], 'Color', [0.8 0 0], 'LineWidth', 1.5);
        
        % Performance Mode
        if isfield(optimalPoints, 'Performance_TTS')
            text(col3_x, y_pos, '1. PERFORMANCE MODE:', 'FontSize', 9, 'FontWeight', 'bold', ...
                'VerticalAlignment', 'top', 'Color', [0.8 0 0]);
            y_pos = y_pos - line_spacing*0.6;
            
            text(col3_x + 0.01, y_pos, sprintf('TTS: %.2e s, Acc: %.1f%%', ...
                optimalPoints.Performance_TTS, optimalPoints.Performance_PassRate * 100), ...
                'FontSize', 8, 'VerticalAlignment', 'top', 'FontWeight', 'bold');
            y_pos = y_pos - line_spacing*0.6;
            
            % Show key parameter values
            keyParams = {'vdd', 'vcm', 'vref', 'i_bld_n', 'i_bld_p', 'i_tia'};
            for j = 1:length(keyParams)
                fieldName = ['Performance_' keyParams{j}];
                if isfield(optimalPoints, fieldName)
                    text(col3_x + 0.02, y_pos, sprintf('%s=%.3f', upper(keyParams{j}), optimalPoints.(fieldName)), ...
                        'FontSize', 7, 'VerticalAlignment', 'top', 'Color', [0.3 0.3 0.3]);
                    y_pos = y_pos - line_spacing*0.4;
                end
            end
            y_pos = y_pos - line_spacing*0.3;
        end
        
        % Energy Efficient Mode
        if isfield(optimalPoints, 'Energy_TTS')
            text(col3_x, y_pos, '2. ENERGY EFFICIENT MODE:', 'FontSize', 9, 'FontWeight', 'bold', ...
                'VerticalAlignment', 'top', 'Color', [0 0.6 0]);
            y_pos = y_pos - line_spacing*0.6;
            
            text(col3_x + 0.01, y_pos, sprintf('ETS: %.2e J, Acc: %.1f%%', ...
                optimalPoints.Energy_ETS, optimalPoints.Energy_PassRate * 100), ...
                'FontSize', 8, 'VerticalAlignment', 'top', 'FontWeight', 'bold');
            y_pos = y_pos - line_spacing*0.6;
            
            % Show key parameter values
            for j = 1:length(keyParams)
                fieldName = ['Energy_' keyParams{j}];
                if isfield(optimalPoints, fieldName)
                    text(col3_x + 0.02, y_pos, sprintf('%s=%.3f', upper(keyParams{j}), optimalPoints.(fieldName)), ...
                        'FontSize', 7, 'VerticalAlignment', 'top', 'Color', [0.3 0.3 0.3]);
                    y_pos = y_pos - line_spacing*0.4;
                end
            end
            y_pos = y_pos - line_spacing*0.3;
        end
        
        % Balanced Mode (Recommended)
        if isfield(optimalPoints, 'Balanced_TTS')
            text(col3_x, y_pos, '3. BALANCED MODE (RECOMMENDED):', 'FontSize', 9, 'FontWeight', 'bold', ...
                'VerticalAlignment', 'top', 'Color', [0 0 0.8]);
            y_pos = y_pos - line_spacing*0.6;
            
            text(col3_x + 0.01, y_pos, sprintf('TTS: %.2e s, Acc: %.1f%%', ...
                optimalPoints.Balanced_TTS, optimalPoints.Balanced_PassRate * 100), ...
                'FontSize', 8, 'VerticalAlignment', 'top', 'FontWeight', 'bold');
            y_pos = y_pos - line_spacing*0.6;
            
            % Show key parameter values
            for j = 1:length(keyParams)
                fieldName = ['Balanced_' keyParams{j}];
                if isfield(optimalPoints, fieldName)
                    text(col3_x + 0.02, y_pos, sprintf('%s=%.3f', upper(keyParams{j}), optimalPoints.(fieldName)), ...
                        'FontSize', 7, 'VerticalAlignment', 'top', 'Color', [0.3 0.3 0.3]);
                    y_pos = y_pos - line_spacing*0.4;
                end
            end
        end
    else
        % No optimal points found
        text(col3_x, start_y, 'OPTIMAL CONFIGURATION', 'FontSize', 12, 'FontWeight', 'bold', ...
            'VerticalAlignment', 'top', 'Color', [0.8 0 0]);
        y_pos = start_y - line_spacing*1.2;
        
        line([col3_x col3_x+0.25], [y_pos+0.02 y_pos+0.02], 'Color', [0.8 0 0], 'LineWidth', 1.5);
        
        text(col3_x, y_pos, 'No optimal points identified', 'FontSize', 10, ...
            'VerticalAlignment', 'top', 'Color', [0.5 0.5 0.5]);
    end
    
    % Add footer with testbench configuration and recommendations
    rectangle('Position', [0 0 1 0.12], 'FaceColor', [0.88 0.88 0.92], ...
              'EdgeColor', [0.5 0.5 0.7], 'LineWidth', 1.5);
    
    % Title for footer
    text(0.01, 0.10, 'TESTBENCH CONFIGURATION READY', 'FontSize', 10, 'FontWeight', 'bold', ...
        'VerticalAlignment', 'top', 'Color', [0.1 0.1 0.6]);
    
    % Instructions
    text(0.01, 0.07, '1. Load optimal settings: run >> load_optimal_config  |  2. Use BALANCED mode for general operation  |  3. Switch to PERFORMANCE mode for fastest solving', ...
        'FontSize', 8, 'VerticalAlignment', 'middle', 'Color', [0.3 0.3 0.5], ...
        'FontWeight', 'normal');
    
    % Configuration files generated
    text(0.01, 0.04, 'Files: testbench_optimal_config.csv, load_optimal_config.m, analysis_summary_report.txt', ...
        'FontSize', 7, 'VerticalAlignment', 'middle', 'Color', [0.4 0.4 0.4]);
    
    % Timestamp
    text(0.98, 0.02, sprintf('Generated: %s', datestr(now, 'yyyy-mm-dd HH:MM:SS')), ...
        'FontSize', 7, 'HorizontalAlignment', 'right', 'VerticalAlignment', 'bottom', ...
        'Color', [0.5 0.5 0.5]);
    
    % Add a border around the text area
    rectangle('Position', [0 0 1 1], 'EdgeColor', [0.7 0.7 0.7], 'LineWidth', 1);
    
    % Main title
    sgtitle(sprintf('k-SAT Chip Master Dashboard - Target: %.0f%% Accuracy', targetPassRate*100), ...
        'FontSize', 16, 'FontWeight', 'bold', 'Color', [0.1 0.1 0.5]);
    
    % Save figure if requested
    if saveFigs
        saveas(gcf, [figPrefix '_master_dashboard.png'], 'png');
        fprintf('Master dashboard saved as: %s_master_dashboard.png\n', figPrefix);
    end
end

%% Helper Functions

function optimalPoints = findOptimalPoints(data, existingParams, targetPassRate)
    % Find optimal operating points based on different criteria
    
    optimalPoints = struct();
    
    % 1. Best Performance (Lowest TTS with high accuracy)
    if ismember('avgTTS', data.Properties.VariableNames) && ismember('passRate', data.Properties.VariableNames)
        highAccuracy = data.passRate > targetPassRate;
        if any(highAccuracy)
            % Find non-zero TTS values among high accuracy points
            highAccData = data(highAccuracy, :);
            validTTS = highAccData.avgTTS > 0; % Exclude zero TTS
            
            if any(validTTS)
                validHighAccData = highAccData(validTTS, :);
                [minTTS, idxPerf] = min(validHighAccData.avgTTS);
                
                % Get the actual index in the high accuracy subset
                highAccIdx = find(highAccuracy);
                validHighAccIdx = highAccIdx(validTTS);
                perfIdx = validHighAccIdx(idxPerf);
                
                optimalPoints.Performance_TTS = data.avgTTS(perfIdx);
                optimalPoints.Performance_PassRate = data.passRate(perfIdx);
                if ismember('power', data.Properties.VariableNames)
                    optimalPoints.Performance_Power = data.power(perfIdx);
                end
                
                for p = 1:length(existingParams)
                    optimalPoints.(['Performance_' existingParams{p}]) = data.(existingParams{p})(perfIdx);
                end
                
                fprintf('\nBest Performance (Lowest TTS @ >%.0f%% accuracy):\n', targetPassRate*100);
                fprintf('  TTS: %.6f seconds\n', optimalPoints.Performance_TTS);
                fprintf('  Pass Rate: %.2f%%\n', optimalPoints.Performance_PassRate * 100);
            end
        end
    end
    
    % 2. Best Energy Efficiency
    if ismember('ETS', data.Properties.VariableNames) && ismember('passRate', data.Properties.VariableNames)
        highAccuracy = data.passRate > targetPassRate;
        if any(highAccuracy)
            validETS = data.ETS(highAccuracy);
            % Exclude zero or invalid ETS values
            validIdx = validETS > 0 & ~isnan(validETS) & ~isinf(validETS);
            
            if any(validIdx)
                validETS = validETS(validIdx);
                [minETS, idxEnergy] = min(validETS);
                
                % Map back to original indices
                highAccIdx = find(highAccuracy);
                validHighAccIdx = highAccIdx(validIdx);
                energyIdx = validHighAccIdx(idxEnergy);
                
                optimalPoints.Energy_ETS = data.ETS(energyIdx);
                optimalPoints.Energy_TTS = data.avgTTS(energyIdx);
                optimalPoints.Energy_PassRate = data.passRate(energyIdx);
                
                for p = 1:length(existingParams)
                    optimalPoints.(['Energy_' existingParams{p}]) = data.(existingParams{p})(energyIdx);
                end
                
                fprintf('\nBest Energy Efficiency:\n');
                fprintf('  ETS: %.9f Joules\n', optimalPoints.Energy_ETS);
                fprintf('  TTS: %.6f seconds\n', optimalPoints.Energy_TTS);
            end
        end
    end
    
    % 3. Best Accuracy
    if ismember('passRate', data.Properties.VariableNames)
        [maxPass, idxAcc] = max(data.passRate);
        
        optimalPoints.Accuracy_PassRate = data.passRate(idxAcc);
        if ismember('avgTTS', data.Properties.VariableNames)
            optimalPoints.Accuracy_TTS = data.avgTTS(idxAcc);
        end
        
        for p = 1:length(existingParams)
            optimalPoints.(['Accuracy_' existingParams{p}]) = data.(existingParams{p})(idxAcc);
        end
        
        fprintf('\nBest Accuracy:\n');
        fprintf('  Pass Rate: %.2f%%\n', optimalPoints.Accuracy_PassRate * 100);
    end
    
    % 4. Balanced Optimal (Multi-objective)
    if ismember('avgTTS', data.Properties.VariableNames) && ismember('passRate', data.Properties.VariableNames)
        % Only consider points above minimum accuracy threshold
        validIdx = data.passRate > (targetPassRate * 0.9); % 90% of target
        
        if any(validIdx)
            validData = data(validIdx, :);
            
            % Normalize metrics
            if max(validData.avgTTS) > min(validData.avgTTS)
                normTTS = (validData.avgTTS - min(validData.avgTTS)) / (max(validData.avgTTS) - min(validData.avgTTS));
            else
                normTTS = zeros(size(validData.avgTTS));
            end
            normAccuracy = 1 - validData.passRate; % Convert to minimization
            
            if ismember('ETS', data.Properties.VariableNames)
                if max(validData.ETS) > min(validData.ETS)
                    normETS = (validData.ETS - min(validData.ETS)) / (max(validData.ETS) - min(validData.ETS));
                else
                    normETS = zeros(size(validData.ETS));
                end
                combinedScore = normTTS + normAccuracy + normETS;
            else
                combinedScore = normTTS + normAccuracy;
            end
            
            [~, idxBalanced] = min(combinedScore);
            balancedIdx = find(validIdx);
            balancedIdx = balancedIdx(idxBalanced);
            
            optimalPoints.Balanced_PassRate = data.passRate(balancedIdx);
            optimalPoints.Balanced_TTS = data.avgTTS(balancedIdx);
            if ismember('ETS', data.Properties.VariableNames)
                optimalPoints.Balanced_ETS = data.ETS(balancedIdx);
            end
            
            for p = 1:length(existingParams)
                optimalPoints.(['Balanced_' existingParams{p}]) = data.(existingParams{p})(balancedIdx);
            end
            
            fprintf('\nBalanced Optimal:\n');
            fprintf('  Pass Rate: %.2f%%\n', optimalPoints.Balanced_PassRate * 100);
            fprintf('  TTS: %.6f seconds\n', optimalPoints.Balanced_TTS);
        end
    end
end

function importance = calculateParameterImportance(data, existingParams)
    % Calculate parameter importance based on correlation and variance contribution
    
    nParams = length(existingParams);
    importance = table();
    importance.Parameter = existingParams';
    
    if ismember('avgTTS', data.Properties.VariableNames)
        % Correlation with TTS
        corrTTS = zeros(nParams, 1);
        for i = 1:nParams
            paramData = data.(existingParams{i});
            validIdx = ~isnan(paramData) & ~isnan(data.avgTTS) & data.avgTTS > 0;
            
            if sum(validIdx) > 10
                % Check if parameter has variation
                uniqueVals = unique(paramData(validIdx));
                if length(uniqueVals) > 1
                    corrTTS(i) = abs(corr(paramData(validIdx), data.avgTTS(validIdx)));
                else
                    corrTTS(i) = 0; % No variation, no correlation
                end
            else
                corrTTS(i) = NaN;
            end
        end
        importance.CorrWithTTS = corrTTS;
        
        % Variance contribution
        varContrib = zeros(nParams, 1);
        for i = 1:nParams
            paramVals = data.(existingParams{i});
            validIdx = ~isnan(paramVals) & ~isnan(data.avgTTS) & data.avgTTS > 0;
            
            if sum(validIdx) > 20
                uniqueVals = unique(paramVals(validIdx));
                if length(uniqueVals) > 1
                    % Use quantile-based binning
                    nBins = min(5, length(uniqueVals));
                    if nBins > 1
                        binEdges = quantile(paramVals(validIdx), linspace(0, 1, nBins+1));
                        binEdges(1) = binEdges(1) - eps; % Ensure all values are included
                        [~, bins] = histc(paramVals(validIdx), binEdges);
                        
                        % Calculate variance contribution
                        ttsVals = data.avgTTS(validIdx);
                        groupMeans = accumarray(bins, ttsVals, [], @mean);
                        groupCounts = accumarray(bins, ones(size(bins)));
                        
                        totalVar = var(ttsVals);
                        if totalVar > 0
                            betweenGroupVar = sum(groupCounts .* (groupMeans - mean(ttsVals)).^2) / sum(groupCounts);
                            varContrib(i) = betweenGroupVar / totalVar;
                        else
                            varContrib(i) = 0;
                        end
                    else
                        varContrib(i) = 0;
                    end
                else
                    varContrib(i) = 0; % No variation
                end
            else
                varContrib(i) = 0;
            end
        end
        importance.VarianceContribution = varContrib;
        
        % Combined score (handle NaN values)
        validCorr = ~isnan(importance.CorrWithTTS);
        if any(validCorr)
            zCorr = zeros(size(importance.CorrWithTTS));
            zCorr(validCorr) = zscore(importance.CorrWithTTS(validCorr));
            
            zVar = zeros(size(importance.VarianceContribution));
            if any(importance.VarianceContribution > 0)
                zVar = zscore(importance.VarianceContribution);
            end
            
            importance.Score = zCorr + zVar;
        else
            importance.Score = zeros(nParams, 1);
        end
        
        % Sort by score
        importance = sortrows(importance, 'Score', 'descend');
    end
end

function createParetoPlot(dataViz, targetPassRate)
    % Create Pareto front plot for ETS vs TTS
    
    if ismember('avgTTS', dataViz.Properties.VariableNames) && ismember('ETS', dataViz.Properties.VariableNames)
        validIdx = dataViz.avgTTS > 0 & dataViz.ETS > 0 & ~isnan(dataViz.avgTTS) & ~isnan(dataViz.ETS);
        
        scatter(dataViz.avgTTS(validIdx), dataViz.ETS(validIdx) * 1e6, ...
               20, [0.7 0.7 0.7], 'filled', 'MarkerFaceAlpha', 0.3);
        hold on;
        
        % Highlight high accuracy points
        highAccIdx = dataViz.passRate >= targetPassRate & validIdx;
        if any(highAccIdx)
            scatter(dataViz.avgTTS(highAccIdx), dataViz.ETS(highAccIdx) * 1e6, ...
                   40, dataViz.passRate(highAccIdx) * 100, 'filled', 'MarkerFaceAlpha', 0.8);
            
            % Find and plot Pareto front
            tts_high = dataViz.avgTTS(highAccIdx);
            ets_high = dataViz.ETS(highAccIdx);
            
            paretoIdx = findParetoFront(tts_high, ets_high);
            if sum(paretoIdx) > 1
                [sortedTTS, sortIdx] = sort(tts_high(paretoIdx));
                sortedETS = ets_high(paretoIdx);
                sortedETS = sortedETS(sortIdx);
                plot(sortedTTS, sortedETS * 1e6, 'r-', 'LineWidth', 2);
                scatter(sortedTTS, sortedETS * 1e6, 60, 'r', 'filled', 'MarkerEdgeColor', 'k');
            end
        end
        
        xlabel('Time to Solution (s)', 'FontSize', 10);
        ylabel('Energy to Solution (μJ)', 'FontSize', 10);
        title('Pareto Front: Performance vs Energy', 'FontSize', 11, 'FontWeight', 'bold');
        grid on;
        colorbar;
        c = colorbar;
        c.Label.String = 'Pass Rate (%)';
        hold off;
    end
end

function paretoIdx = findParetoFront(x, y)
    % Find indices of Pareto optimal points (minimizing both x and y)
    n = length(x);
    paretoIdx = true(n, 1);
    
    for i = 1:n
        for j = 1:n
            if i ~= j && x(j) <= x(i) && y(j) <= y(i) && ...
               (x(j) < x(i) || y(j) < y(i))
                paretoIdx(i) = false;
                break;
            end
        end
    end
end

function str = addCommas(num)
    % Add commas to large numbers for readability
    str = sprintf('%d', num);
    if length(str) > 3
        str = regexprep(str, '(\d)(?=(\d{3})+$)', '$1,');
    end
end

function insights = extractInsights(data, existingParams, targetPassRate)
    % Extract key insights and relationships
    
    insights = struct();
    
    %% Critical Thresholds
    fprintf('\n--- Critical Thresholds ---\n');
    
    if ismember('passRate', data.Properties.VariableNames)
        thresholds = struct();
        
        for i = 1:length(existingParams)
            param = existingParams{i};
            paramVals = data.(param);
            
            highAccIdx = data.passRate > targetPassRate;
            if sum(highAccIdx) > 10
                validVals = paramVals(highAccIdx);
                validVals = validVals(~isnan(validVals));
                
                if ~isempty(validVals)
                    minVal95 = min(validVals);
                    maxVal95 = max(validVals);
                    
                    thresholds.(param) = [minVal95; maxVal95];
                    
                    fprintf('%s: [%.3f, %.3f] for >%.0f%% accuracy\n', ...
                        upper(param), minVal95, maxVal95, targetPassRate*100);
                end
            end
        end
        
        insights.criticalThresholds = thresholds;
    end
    
    %% Performance Cliffs
    fprintf('\n--- Performance Cliffs ---\n');
    
    if ismember('avgTTS', data.Properties.VariableNames)
        cliffs = {};
        
        for i = 1:length(existingParams)
            param = existingParams{i};
            paramVals = data.(param);
            ttsVals = data.avgTTS;
            
            validIdx = ~isnan(paramVals) & ~isnan(ttsVals) & ttsVals > 0;
            if sum(validIdx) > 100
                [sortedParam, sortIdx] = sort(paramVals(validIdx));
                sortedTTS = ttsVals(validIdx);
                sortedTTS = sortedTTS(sortIdx);
                
                uniqueParams = unique(sortedParam);
                if length(uniqueParams) > 10
                    % Look for significant changes
                    smoothTTS = smooth(sortedTTS, min(5, floor(length(sortedTTS)/20)));
                    gradient = diff(smoothTTS) ./ diff(sortedParam);
                    
                    threshold = 3 * std(gradient(~isnan(gradient) & ~isinf(gradient)));
                    if threshold > 0
                        cliffIdx = find(abs(gradient) > threshold);
                        
                        if ~isempty(cliffIdx)
                            fprintf('%s shows performance cliff around: ', upper(param));
                            for j = 1:min(3, length(cliffIdx))
                                fprintf('%.3f ', sortedParam(cliffIdx(j)));
                            end
                            fprintf('\n');
                            
                            cliffs{end+1} = struct('parameter', param, ...
                                'locations', sortedParam(cliffIdx(1:min(3, length(cliffIdx)))));
                        end
                    end
                end
            end
        end
        
        insights.performanceCliffs = cliffs;
    end
    
    %% Optimal Operating Windows
    fprintf('\n--- Optimal Operating Windows ---\n');
    
    if ismember('avgTTS', data.Properties.VariableNames) && ismember('passRate', data.Properties.VariableNames)
        highAccIdx = data.passRate > targetPassRate;
        if sum(highAccIdx) > 10
            highAccTTS = data.avgTTS(highAccIdx);
            validHighTTS = highAccTTS(highAccTTS > 0);
            
            if ~isempty(validHighTTS)
                threshold = quantile(validHighTTS, 0.1);
                
                optimalIdx = highAccIdx & data.avgTTS <= threshold & data.avgTTS > 0;
                
                fprintf('Found %d optimal operating points (top 10%% performance)\n', sum(optimalIdx));
                
                optimalWindows = struct();
                for i = 1:length(existingParams)
                    param = existingParams{i};
                    optimalVals = data.(param)(optimalIdx);
                    optimalVals = optimalVals(~isnan(optimalVals));
                    
                    if ~isempty(optimalVals)
                        optimalWindows.(param) = [
                            min(optimalVals);
                            quantile(optimalVals, 0.25);
                            median(optimalVals);
                            quantile(optimalVals, 0.75);
                            max(optimalVals)
                        ];
                        
                        fprintf('%s: [%.3f - %.3f], median: %.3f\n', ...
                            upper(param), min(optimalVals), max(optimalVals), median(optimalVals));
                    end
                end
                
                insights.optimalWindows = optimalWindows;
            end
        end
    end
    
    %% Summary
    fprintf('\n--- Insights Summary ---\n');
    if isfield(insights, 'criticalThresholds') && ~isempty(fieldnames(insights.criticalThresholds))
        fprintf('1. Critical thresholds identified for %d parameters\n', ...
            length(fieldnames(insights.criticalThresholds)));
    end
    
    if isfield(insights, 'performanceCliffs') && ~isempty(insights.performanceCliffs)
        fprintf('2. Performance cliffs detected in %d parameters\n', ...
            length(insights.performanceCliffs));
    end
    
    if isfield(insights, 'optimalWindows') && ~isempty(fieldnames(insights.optimalWindows))
        fprintf('3. Optimal operating windows defined for parameters\n');
    end
end

function generateReport(data, existingParams, existingMetrics, optimalPoints, insights, targetPassRate)
    % Generate comprehensive analysis report
    
    reportFile = fullfile('analysis_outputs', 'analysis_summary_report.txt');
    fid = fopen(reportFile, 'w');
    
    fprintf(fid, 'K-SAT CHIP OPTIMIZATION ANALYSIS REPORT\n');
    fprintf(fid, '======================================\n');
    fprintf(fid, 'Generated: %s\n\n', datestr(now));
    
    % Dataset summary
    fprintf(fid, 'DATASET SUMMARY\n');
    fprintf(fid, '---------------\n');
    fprintf(fid, 'Total experiments: %d\n', height(data));
    fprintf(fid, 'Operating parameters: %d (%s)\n', length(existingParams), strjoin(existingParams, ', '));
    fprintf(fid, 'Performance metrics: %d (%s)\n\n', length(existingMetrics), strjoin(existingMetrics, ', '));
    
    % Performance metrics
    if ismember('avgTTS', data.Properties.VariableNames) && ismember('passRate', data.Properties.VariableNames)
        fprintf(fid, 'PERFORMANCE METRICS\n');
        fprintf(fid, '-------------------\n');
        
        validTTS = data.avgTTS(data.avgTTS > 0);
        if ~isempty(validTTS)
            fprintf(fid, 'Time to Solution (TTS):\n');
            fprintf(fid, '  Range: [%.6f, %.6f] s\n', min(validTTS), max(validTTS));
            fprintf(fid, '  Mean ± Std: %.6f ± %.6f s\n', mean(validTTS), std(validTTS));
            fprintf(fid, '  Median: %.6f s\n', median(validTTS));
        end
        fprintf(fid, '\n');
        
        fprintf(fid, 'Pass Rate:\n');
        fprintf(fid, '  Range: [%.2f%%, %.2f%%]\n', min(data.passRate)*100, max(data.passRate)*100);
        fprintf(fid, '  Mean: %.2f%%\n', mean(data.passRate)*100);
        fprintf(fid, '  Points > %.0f%%: %d (%.1f%%)\n', ...
            targetPassRate*100, sum(data.passRate > targetPassRate), ...
            sum(data.passRate > targetPassRate)/height(data)*100);
        fprintf(fid, '\n');
    end
    
    % Optimal operating points
    if ~isempty(optimalPoints) && isstruct(optimalPoints)
        fprintf(fid, 'OPTIMAL OPERATING POINTS\n');
        fprintf(fid, '------------------------\n');
        
        % Balanced configuration
        if isfield(optimalPoints, 'Balanced_TTS')
            fprintf(fid, '\n1. BALANCED CONFIGURATION (Recommended):\n');
            fprintf(fid, '   Performance: TTS = %.6f s, Pass Rate = %.2f%%', ...
                optimalPoints.Balanced_TTS, optimalPoints.Balanced_PassRate*100);
            if isfield(optimalPoints, 'Balanced_ETS')
                fprintf(fid, ', ETS = %.9f J', optimalPoints.Balanced_ETS);
            end
            fprintf(fid, '\n   Parameters:\n');
            for i = 1:length(existingParams)
                field = ['Balanced_' existingParams{i}];
                if isfield(optimalPoints, field)
                    fprintf(fid, '     %s = %.3f\n', upper(existingParams{i}), optimalPoints.(field));
                end
            end
        end
        
        fprintf(fid, '\n');
    end
    
    % Key insights
    if exist('insights', 'var') && ~isempty(insights)
        fprintf(fid, 'KEY INSIGHTS\n');
        fprintf(fid, '------------\n');
        
        if isfield(insights, 'criticalThresholds') && ~isempty(fieldnames(insights.criticalThresholds))
            fprintf(fid, '\nCritical Parameter Thresholds (for >%.0f%% accuracy):\n', targetPassRate*100);
            params = fieldnames(insights.criticalThresholds);
            for i = 1:length(params)
                vals = insights.criticalThresholds.(params{i});
                if length(vals) >= 2
                    fprintf(fid, '  %s: [%.3f, %.3f]\n', upper(params{i}), vals(1), vals(2));
                end
            end
        end
        
        if isfield(insights, 'performanceCliffs') && ~isempty(insights.performanceCliffs)
            fprintf(fid, '\nPerformance Cliffs Detected:\n');
            for i = 1:length(insights.performanceCliffs)
                cliff = insights.performanceCliffs{i};
                fprintf(fid, '  %s at: ', upper(cliff.parameter));
                fprintf(fid, '%.3f ', cliff.locations);
                fprintf(fid, '\n');
            end
        end
    end
    
    % Files generated
    fprintf(fid, '\nOUTPUT FILES GENERATED\n');
    fprintf(fid, '----------------------\n');
    fprintf(fid, '- analysis_outputs/summary_statistics.csv\n');
    fprintf(fid, '- analysis_outputs/optimal_operating_points.csv\n');
    fprintf(fid, '- analysis_outputs/testbench_optimal_config.csv\n');
    fprintf(fid, '- analysis_outputs/load_optimal_config.m\n');
    fprintf(fid, '- analysis_outputs/analysis_insights.mat\n');
    fprintf(fid, '- analysis_outputs/ksat_analysis_master_dashboard.png\n');

    fclose(fid);
    
    fprintf('\nSummary report saved to: %s\n', reportFile);
end

function createTestbenchConfig(optimalPoints, existingParams)
    % Create testbench configuration files for all operating modes
    
    % Check if optimalPoints is valid
    if isempty(optimalPoints) || ~isstruct(optimalPoints)
        fprintf('Warning: No optimal points found. Skipping testbench configuration.\n');
        return;
    end
    
    % Define the key parameters for testbench
    keyParams = {'vdd', 'vcm', 'vref', 'i_tia', 'i_bld_n', 'i_bld_p', 'i_break', 'i_make', 'i_cmp'};
    
    % Create comprehensive MATLAB script with all modes
    fid = fopen(fullfile('analysis_outputs', 'load_optimal_config.m'), 'w');
    fprintf(fid, '%% k-SAT Chip Optimal Configurations\n');
    fprintf(fid, '%% Auto-generated from analysis on %s\n\n', datestr(now));
    
    % Performance Mode
    if isfield(optimalPoints, 'Performance_TTS')
        fprintf(fid, '%% ========================================\n');
        fprintf(fid, '%% PERFORMANCE MODE (Fastest Solving)\n');
        fprintf(fid, '%% TTS: %.6e s, Accuracy: %.2f%%\n', ...
            optimalPoints.Performance_TTS, optimalPoints.Performance_PassRate * 100);
        fprintf(fid, '%% ========================================\n');
        
        for i = 1:length(keyParams)
            fieldName = ['Performance_' keyParams{i}];
            if isfield(optimalPoints, fieldName)
                fprintf(fid, '%s_performance = %.6f;\n', keyParams{i}, optimalPoints.(fieldName));
            end
        end
        fprintf(fid, '\n');
    end
    
    % Energy Efficient Mode
    if isfield(optimalPoints, 'Energy_TTS')
        fprintf(fid, '%% ========================================\n');
        fprintf(fid, '%% ENERGY EFFICIENT MODE (Lowest Power)\n');
        if isfield(optimalPoints, 'Energy_ETS')
            fprintf(fid, '%% ETS: %.6e J, Accuracy: %.2f%%\n', ...
                optimalPoints.Energy_ETS, optimalPoints.Energy_PassRate * 100);
        else
            fprintf(fid, '%% TTS: %.6e s, Accuracy: %.2f%%\n', ...
                optimalPoints.Energy_TTS, optimalPoints.Energy_PassRate * 100);
        end
        fprintf(fid, '%% ========================================\n');
        
        for i = 1:length(keyParams)
            fieldName = ['Energy_' keyParams{i}];
            if isfield(optimalPoints, fieldName)
                fprintf(fid, '%s_energy = %.6f;\n', keyParams{i}, optimalPoints.(fieldName));
            end
        end
        fprintf(fid, '\n');
    end
    
    % Balanced Mode (Default/Recommended)
    if isfield(optimalPoints, 'Balanced_TTS')
        fprintf(fid, '%% ========================================\n');
        fprintf(fid, '%% BALANCED MODE (RECOMMENDED DEFAULT)\n');
        fprintf(fid, '%% TTS: %.6e s, Accuracy: %.2f%%\n', ...
            optimalPoints.Balanced_TTS, optimalPoints.Balanced_PassRate * 100);
        fprintf(fid, '%% ========================================\n');
        
        for i = 1:length(keyParams)
            fieldName = ['Balanced_' keyParams{i}];
            if isfield(optimalPoints, fieldName)
                fprintf(fid, '%s = %.6f;  %% Default balanced setting\n', ...
                    keyParams{i}, optimalPoints.(fieldName));
            end
        end
        fprintf(fid, '\n');
    end
    
    % Add helper functions
    fprintf(fid, '%% Helper function to load specific mode\n');
    fprintf(fid, 'function loadMode(mode)\n');
    fprintf(fid, '    switch lower(mode)\n');
    
    if isfield(optimalPoints, 'Performance_TTS')
        fprintf(fid, '        case ''performance''\n');
        for i = 1:length(keyParams)
            fieldName = ['Performance_' keyParams{i}];
            if isfield(optimalPoints, fieldName)
                fprintf(fid, '            assignin(''base'', ''%s'', %s_performance);\n', ...
                    keyParams{i}, keyParams{i});
            end
        end
        fprintf(fid, '            fprintf(''Performance mode loaded\\n'');\n');
    end
    
    if isfield(optimalPoints, 'Energy_TTS')
        fprintf(fid, '        case ''energy''\n');
        for i = 1:length(keyParams)
            fieldName = ['Energy_' keyParams{i}];
            if isfield(optimalPoints, fieldName)
                fprintf(fid, '            assignin(''base'', ''%s'', %s_energy);\n', ...
                    keyParams{i}, keyParams{i});
            end
        end
        fprintf(fid, '            fprintf(''Energy efficient mode loaded\\n'');\n');
    end
    
    if isfield(optimalPoints, 'Balanced_TTS')
        fprintf(fid, '        case ''balanced''\n');
        for i = 1:length(keyParams)
            fieldName = ['Balanced_' keyParams{i}];
            if isfield(optimalPoints, fieldName)
                fprintf(fid, '            assignin(''base'', ''%s'', %s);\n', ...
                    keyParams{i}, keyParams{i});
            end
        end
        fprintf(fid, '            fprintf(''Balanced mode loaded (default)\\n'');\n');
    end
    
    fprintf(fid, '        otherwise\n');
    fprintf(fid, '            fprintf(''Unknown mode. Use: performance, energy, or balanced\\n'');\n');
    fprintf(fid, '    end\n');
    fprintf(fid, 'end\n\n');
    
    fprintf(fid, 'fprintf(''\\nOptimal configurations loaded!\\n'');\n');
    fprintf(fid, 'fprintf(''Use loadMode(''''performance'''') for fastest solving\\n'');\n');
    fprintf(fid, 'fprintf(''Use loadMode(''''energy'''') for lowest power\\n'');\n');
    fprintf(fid, 'fprintf(''Use loadMode(''''balanced'''') for recommended settings\\n'');\n');
    
    fclose(fid);
    
    % Also create a CSV summary for easy reference
    configTable = table();
    modes = {};
    
    if isfield(optimalPoints, 'Performance_TTS')
        modes{end+1} = 'Performance';
        for i = 1:length(keyParams)
            fieldName = ['Performance_' keyParams{i}];
            if isfield(optimalPoints, fieldName)
                configTable.Performance(i) = optimalPoints.(fieldName);
            else
                configTable.Performance(i) = NaN;
            end
        end
    end
    
    if isfield(optimalPoints, 'Energy_TTS')
        modes{end+1} = 'Energy';
        for i = 1:length(keyParams)
            fieldName = ['Energy_' keyParams{i}];
            if isfield(optimalPoints, fieldName)
                configTable.Energy(i) = optimalPoints.(fieldName);
            else
                configTable.Energy(i) = NaN;
            end
        end
    end
    
    if isfield(optimalPoints, 'Balanced_TTS')
        modes{end+1} = 'Balanced';
        for i = 1:length(keyParams)
            fieldName = ['Balanced_' keyParams{i}];
            if isfield(optimalPoints, fieldName)
                configTable.Balanced(i) = optimalPoints.(fieldName);
            else
                configTable.Balanced(i) = NaN;
            end
        end
    end
    
    % Set row names
    configTable.Properties.RowNames = keyParams;
    
    % Save CSV
    if ~isempty(modes)
        writetable(configTable, fullfile('analysis_outputs', 'testbench_optimal_config.csv'), 'WriteRowNames', true);
        fprintf('Testbench configurations saved for modes: %s\n', strjoin(modes, ', '));
    else
        fprintf('Warning: No optimal configurations found to save.\n');
    end
end