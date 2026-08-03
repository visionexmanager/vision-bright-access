export function targetDistance(power:number,accuracy:number,targetPower:number){return Math.abs(power-targetPower)*1.2+Math.abs(accuracy-50)*.8;}
export function golfStrokes(distance:number){return distance<8?1:distance<20?2:distance<35?3:4;}
export function bowlingPins(power:number,accuracy:number){const miss=Math.abs(power-78)+Math.abs(accuracy-50)*1.4;return Math.max(0,Math.min(10,10-Math.floor(miss/9)));}
export function archeryScore(power:number,accuracy:number){const distance=targetDistance(power,accuracy,72);return distance<5?10:distance<12?9:distance<22?7:distance<35?5:distance<50?3:0;}
export function dartScore(x:number,y:number){const d=Math.hypot(x-50,y-50);if(d<5)return 50;if(d<12)return 25;if(d>50)return 0;const sectors=[6,13,4,18,1,20,5,12,9,14,11,8,16,7,19,3,17,2,15,10];const angle=(Math.atan2(y-50,x-50)*180/Math.PI+99+360)%360;const base=sectors[Math.floor(angle/18)];if(d>43)return base*2;if(d>27&&d<32)return base*3;return base;}
