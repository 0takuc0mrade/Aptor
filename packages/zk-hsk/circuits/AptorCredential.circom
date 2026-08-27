pragma circom 2.1.6;

include "circomlib/circuits/comparators.circom";
include "circomlib/circuits/poseidon.circom";

template AptorCredential() {
    // Public outputs, in this order.
    signal output credentialCommitment;
    signal output requestNullifier;

    // Private credential witness.
    signal input skillHash;
    signal input experienceMonths;
    signal input productionExperience;
    signal input ratingHundredths;
    signal input credentialSecret;

    // Public verifier request.
    signal input requiredSkillHash;
    signal input minimumMonths;
    signal input requiresProduction;
    signal input minimumRatingHundredths;
    signal input requestId;

    // Bind the public commitment and request nullifier to the same secret.
    component commitmentHasher = Poseidon(5);
    commitmentHasher.inputs[0] <== skillHash;
    commitmentHasher.inputs[1] <== experienceMonths;
    commitmentHasher.inputs[2] <== productionExperience;
    commitmentHasher.inputs[3] <== ratingHundredths;
    commitmentHasher.inputs[4] <== credentialSecret;
    credentialCommitment <== commitmentHasher.out;

    component nullifierHasher = Poseidon(2);
    nullifierHasher.inputs[0] <== credentialSecret;
    nullifierHasher.inputs[1] <== requestId;
    requestNullifier <== nullifierHasher.out;

    // One required skill for the hackathon MVP.
    skillHash === requiredSkillHash;

    // Both month values are unsigned 16-bit integers.
    component experienceFits = Num2Bits(16);
    experienceFits.in <== experienceMonths;
    component minimumFits = Num2Bits(16);
    minimumFits.in <== minimumMonths;
    component meetsMonths = GreaterEqThan(16);
    meetsMonths.in[0] <== experienceMonths;
    meetsMonths.in[1] <== minimumMonths;
    meetsMonths.out === 1;

    // Private and public production flags are strictly boolean.
    productionExperience * (productionExperience - 1) === 0;
    requiresProduction * (requiresProduction - 1) === 0;
    productionExperience * requiresProduction === requiresProduction;

    // Aptor ratings use hundredths and are bounded to 0..500.
    component ratingFits = Num2Bits(9);
    ratingFits.in <== ratingHundredths;
    component minimumRatingFits = Num2Bits(9);
    minimumRatingFits.in <== minimumRatingHundredths;
    component ratingAtMostFive = LessEqThan(9);
    ratingAtMostFive.in[0] <== ratingHundredths;
    ratingAtMostFive.in[1] <== 500;
    ratingAtMostFive.out === 1;
    component minimumAtMostFive = LessEqThan(9);
    minimumAtMostFive.in[0] <== minimumRatingHundredths;
    minimumAtMostFive.in[1] <== 500;
    minimumAtMostFive.out === 1;
    component meetsRating = GreaterEqThan(9);
    meetsRating.in[0] <== ratingHundredths;
    meetsRating.in[1] <== minimumRatingHundredths;
    meetsRating.out === 1;
}

component main { public [requiredSkillHash, minimumMonths, requiresProduction, minimumRatingHundredths, requestId] } = AptorCredential();
