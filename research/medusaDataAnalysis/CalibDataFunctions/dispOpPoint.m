function dispOpPoint(index, label, vdd, vcm, vref, i_make, i_break, i_bld_p, i_bld_n, i_cmp, i_tia)
  disp(strcat("Operating Point: ", label));
  disp(strcat(" VDD:       ", string(vdd(index)), " V"));
  disp(strcat(" VCM:       ", string(vcm(index)), " V"));
  disp(strcat(" VREF:      ", string(vref(index)), " V"));
  disp(strcat(" I_MAKE:    ", string(i_make(index)), " uA"));
  disp(strcat(" I_BREAK:   ", string(i_break(index)), " uA"));
  disp(strcat(" I_BLD_P:   ", string(i_bld_p(index)), " uA"));
  disp(strcat(" I_BLD_N:   ", string(i_bld_n(index)), " uA"));
  disp(strcat(" I_CMP:     ", string(i_cmp(index)), " uA"));
  disp(strcat(" I_TIA:     ", string(i_tia(index)), " uA"));
  disp(" ");
end