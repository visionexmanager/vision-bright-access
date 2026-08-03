export type DrawingCell = 0 | 1 | 2 | 3;
export const DRAWING_SIZE = 6;
export const emptyDrawing = (): DrawingCell[] => Array(DRAWING_SIZE * DRAWING_SIZE).fill(0);
export function paintCell(grid:DrawingCell[],index:number,color:DrawingCell){if(index<0||index>=grid.length)return grid;const next=[...grid];next[index]=color;return next}
export function mirrorIndex(index:number,size=DRAWING_SIZE){const row=Math.floor(index/size),column=index%size;return row*size+(size-1-column)}
export function paintSymmetric(grid:DrawingCell[],index:number,color:DrawingCell){let next=paintCell(grid,index,color);next=paintCell(next,mirrorIndex(index),color);return next}
export function symmetryScore(grid:DrawingCell[],size=DRAWING_SIZE){let compared=0,matches=0;for(let row=0;row<size;row++)for(let column=0;column<Math.floor(size/2);column++){const left=grid[row*size+column],right=grid[row*size+size-1-column];if(left||right){compared++;if(left===right)matches++}}return compared?Math.round(matches/compared*100):0}
export function patternScore(grid:DrawingCell[],target:DrawingCell[]){if(grid.length!==target.length||!grid.length)return 0;return Math.round(grid.filter((cell,index)=>cell===target[index]).length/grid.length*100)}
export function filledBounds(grid:DrawingCell[],size=DRAWING_SIZE){const filled=grid.map((cell,index)=>cell?index:-1).filter(index=>index>=0);if(!filled.length)return{width:0,height:0,area:0};const rows=filled.map(index=>Math.floor(index/size)),columns=filled.map(index=>index%size);const width=Math.max(...columns)-Math.min(...columns)+1,height=Math.max(...rows)-Math.min(...rows)+1;return{width,height,area:width*height}}
export function checkerPattern(size=DRAWING_SIZE):DrawingCell[]{return Array.from({length:size*size},(_,index)=>((Math.floor(index/size)+index%size)%2?2:1)as DrawingCell)}
