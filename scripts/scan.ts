import { runFareScan } from '../lib/scanner.ts';

const result = await runFareScan();
console.log(`Scan complete: ${result.candidatesFound} candidates and ${result.observationsSaved} observations saved from ${result.provider}.`);
