import {test} from 'node:test';
import assert from 'node:assert/strict';
import {dominantColor} from '../../src/lib/photography/dominantColor.mjs';
const pixels=(...groups)=>new Uint8Array(groups.flatMap(([rgb,n])=>Array.from({length:n},()=>[...rgb,255]).flat()));
test('selects a major blue region instead of a tiny saturated red accent',()=>{
 const p=dominantColor(pixels([[24,80,170],80],[[250,10,10],2],[[210,210,210],18]));assert.equal(p.bg,'rgb(24,80,170)');assert.equal(p.textColor,'#ffffff');
});
test('preserves an actual green color without forced hue or saturation',()=>{
 assert.equal(dominantColor(pixels([[32,153,82],80],[[40,40,40],20])).bg,'rgb(32,153,82)');
});
test('monochrome images remain monochrome rather than becoming red',()=>{
 assert.equal(dominantColor(pixels([[180,180,180],80],[[25,25,25],20])).bg,'rgb(180,180,180)');
});
