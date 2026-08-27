pragma circom 2.1.6;

include "circomlib/circuits/comparators.circom";

template ExperienceThreshold() {
    signal input experienceMonths;
    signal input minimumMonths;

    component experienceFits = Num2Bits(16);
    experienceFits.in <== experienceMonths;

    component minimumFits = Num2Bits(16);
    minimumFits.in <== minimumMonths;

    component meetsMinimum = GreaterEqThan(16);
    meetsMinimum.in[0] <== experienceMonths;
    meetsMinimum.in[1] <== minimumMonths;
    meetsMinimum.out === 1;
}

component main { public [minimumMonths] } = ExperienceThreshold();
