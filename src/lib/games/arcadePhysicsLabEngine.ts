export function torque(mass:number,distance:number){return mass*distance}
export function balancedLever(leftMass:number,leftDistance:number,rightMass:number,rightDistance:number,tolerance=.5){return Math.abs(torque(leftMass,leftDistance)-torque(rightMass,rightDistance))<=tolerance}
export function pendulumPeriod(length:number,gravity=9.81){return 2*Math.PI*Math.sqrt(length/gravity)}
export function projectileRange(speed:number,angleDegrees:number,gravity=9.81){const angle=angleDegrees*Math.PI/180;return speed*speed*Math.sin(2*angle)/gravity}
export function magneticForce(strengthA:number,strengthB:number,distance:number,aligned:boolean){const magnitude=strengthA*strengthB/Math.max(1,distance*distance);return aligned?-magnitude:magnitude}
export function physicsScore(error:number){return Math.max(0,Math.round(100-error*10))}
