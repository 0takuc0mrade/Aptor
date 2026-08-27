const chunk = "CORDON_BOUNDED_OUTPUT_FIXTURE".repeat(128) + "\n";
for (let index = 0; index < 1024; index += 1) process.stdout.write(chunk);
