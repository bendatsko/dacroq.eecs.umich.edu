% k-SAT Chip Optimal Configurations
% Auto-generated from analysis on 01-Jul-2025 18:53:53

% ========================================
% PERFORMANCE MODE (Fastest Solving)
% TTS: 1.090935e-07 s, Accuracy: 100.00%
% ========================================
vdd_performance = NaN;
vcm_performance = NaN;
vref_performance = NaN;
i_tia_performance = NaN;
i_bld_n_performance = NaN;
i_bld_p_performance = NaN;
i_break_performance = NaN;
i_make_performance = NaN;
i_cmp_performance = NaN;

% ========================================
% BALANCED MODE (RECOMMENDED DEFAULT)
% TTS: 1.090935e-07 s, Accuracy: 100.00%
% ========================================
vdd = NaN;  % Default balanced setting
vcm = NaN;  % Default balanced setting
vref = NaN;  % Default balanced setting
i_tia = NaN;  % Default balanced setting
i_bld_n = NaN;  % Default balanced setting
i_bld_p = NaN;  % Default balanced setting
i_break = NaN;  % Default balanced setting
i_make = NaN;  % Default balanced setting
i_cmp = NaN;  % Default balanced setting

% Helper function to load specific mode
function loadMode(mode)
    switch lower(mode)
        case 'performance'
            assignin('base', 'vdd', vdd_performance);
            assignin('base', 'vcm', vcm_performance);
            assignin('base', 'vref', vref_performance);
            assignin('base', 'i_tia', i_tia_performance);
            assignin('base', 'i_bld_n', i_bld_n_performance);
            assignin('base', 'i_bld_p', i_bld_p_performance);
            assignin('base', 'i_break', i_break_performance);
            assignin('base', 'i_make', i_make_performance);
            assignin('base', 'i_cmp', i_cmp_performance);
            fprintf('Performance mode loaded\n');
        case 'balanced'
            assignin('base', 'vdd', vdd);
            assignin('base', 'vcm', vcm);
            assignin('base', 'vref', vref);
            assignin('base', 'i_tia', i_tia);
            assignin('base', 'i_bld_n', i_bld_n);
            assignin('base', 'i_bld_p', i_bld_p);
            assignin('base', 'i_break', i_break);
            assignin('base', 'i_make', i_make);
            assignin('base', 'i_cmp', i_cmp);
            fprintf('Balanced mode loaded (default)\n');
        otherwise
            fprintf('Unknown mode. Use: performance, energy, or balanced\n');
    end
end

fprintf('\nOptimal configurations loaded!\n');
fprintf('Use loadMode(''performance'') for fastest solving\n');
fprintf('Use loadMode(''energy'') for lowest power\n');
fprintf('Use loadMode(''balanced'') for recommended settings\n');
