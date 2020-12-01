'use strict'

// 俄羅斯方塊的空間，寬 10 格，高 20 格，單位格子佔畫布 64 單位長
const unitSize = 1 << 6
const width = 10
const height = width << 1
const gapSize = unitSize >> 4

document.documentElement.style.setProperty('--height', height)

// 紀錄佔據 Space 的 cells
// 類似用 Set 存放數對 [x, y]，但是為了有效區別，以 'x,y' 作為 key
class Space extends Map {
    constructor(x, y, color, colorLight, ...cells) {
        super()
        this.center = [x, y]
        this.color = color
        this.colorLight = colorLight
        cells.forEach(cell => this.set(...cell))
    }
    *[Symbol.iterator]() {
        yield* this.values()
    }
    cells() {
        return [...this.values()]
    }
    has(x, y) {
        return super.has([x, y].toString())
    }
    set(x, y) {
        return super.set([x, y].toString(), [x, y])
    }
    delete(x, y) {
        return super.delete([x, y].toString())
    }
    // 依右手定則，逆時針旋轉，一次轉 1/4 圈
    rotated(times) {
        let [x, y] = this.center
        let rotated = new Space(x, y, this.color, this.colorLight)
        switch (times & 3) {
            case 0:
                this.forEach(([tx, ty]) => rotated.set(tx, ty))
                return rotated
            case 1:
                this.forEach(([tx, ty]) => rotated.set(x + y - ty, y - x + tx))
                return rotated
            case 2:
                this.forEach(([tx, ty]) => rotated.set(x + x - tx, y + y - ty))
                return rotated
            case 3:
                this.forEach(([tx, ty]) => rotated.set(x - y + ty, y + x - tx))
                return rotated
        }
    }
}

// 7 種俄羅斯方塊
const tetrominoes = [
    // I
    new Space(1.5, 1.5, '#F44336', '#ffcdd2', [1, 0], [1, 1], [1, 2], [1, 3]),
    // J
    new Space(1, 2, '#9C27B0', '#E1BEE7', [2, 1], [1, 1], [1, 2], [1, 3]),
    // Z
    new Space(1, 2, '#3F51B5', '#C5CAE9', [2, 1], [2, 2], [1, 2], [1, 3]),
    // O
    new Space(1.5, 2.5, '#00BCD4', '#B2EBF2', [2, 3], [2, 2], [1, 2], [1, 3]),
    // T
    new Space(2, 2, '#8BC34A', '#DCEDC8', [2, 3], [2, 2], [1, 2], [2, 1]),
    // S
    new Space(2, 2, '#FFEB3B', '#FFF9C4', [2, 3], [2, 2], [1, 2], [1, 1]),
    // L
    new Space(2, 2, '#FF9800', '#FFCCBC', [2, 3], [2, 2], [2, 1], [1, 1]),
]

// 避免連續出現同一種方塊太多次，這個 iter 最多連續 4 次
const tetrominoIter = function* () {
    // 準備一個袋子，7 種俄羅斯方塊各放 4 個
    const bag = [...tetrominoes, ...tetrominoes, ...tetrominoes, ...tetrominoes]
    // 先隨機選 4 個，放 tetrominoBag 的最後
    for (let k = 4; k; --k) {
        let i = bag.length - k
        let j = ~~((i + 1) * Math.random())
        { [bag[i], bag[j]] = [bag[j], bag[i]] }
    }
    // 最後 4 個作為歷史紀錄，排除選擇
    for (let k = 4; ; k = k % 4 + 1) {
        let i = bag.length - k
        let j = ~~((bag.length - 4) * Math.random())
        { [bag[i], bag[j]] = [bag[j], bag[i]] }
        yield bag[i]
    }
}()


const backCanvas = document.getElementById('back')
const foreCanvas = document.getElementById('fore')
const holdCanvas = document.getElementById('hold')
const nextCanvas = document.getElementById('next')
const backCtx = backCanvas.getContext('2d')
const foreCtx = foreCanvas.getContext('2d')
const nextCtx = nextCanvas.getContext('2d')
const holdCtx = holdCanvas.getContext('2d')
backCanvas.width = foreCanvas.width = width * unitSize
backCanvas.height = foreCanvas.height = (height + 3) * unitSize
holdCanvas.width = nextCanvas.width = 4 * unitSize
holdCanvas.height = nextCanvas.height = 4 * unitSize

function cell(x, y) {
    return [x * unitSize, (y + 3) * unitSize]
}

// getImageData, putImageData 不適用 transform

function size(w, h) {
    return [w * unitSize, h * unitSize]
}

nextCtx.translate(...size(0, -3))
holdCtx.translate(...size(0, -3))

// 畫條紋格狀背景
for (let i = 1; i <= width; i += 2) {
    backCtx.fillStyle = '#888'
    backCtx.fillRect(...cell(i, 0), ...size(-1, height))
    backCtx.lineWidth = gapSize
    for (let j = 0; j < height; ++j) {
        backCtx.strokeRect(...cell(i, j), ...size(-1, 1))
    }
    backCtx.fillStyle = '#000'
    backCtx.fillRect(...cell(i, 0), ...size(1, height))
}

function clear(ctx) {
    ctx.save()
    ctx.resetTransform()
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
    ctx.restore()
}

function fillTetromino(ctx, x, y, r, tetromino, light = false) {
    ctx.save()
    ctx.fillStyle = light ? tetromino.colorLight : tetromino.color
    ctx.globalAlpha = light ? 0.9 : 1
    ctx.lineWidth = gapSize
    for (let [tx, ty] of tetromino.rotated(r)) {
        ctx.fillRect(...cell(x + tx, y + ty), ...size(1, 1))
        ctx.strokeRect(...cell(x + tx, y + ty), ...size(1, 1))
    }
    ctx.restore()
}

function clearTetromino(ctx, x, y, r, tetromino) {
    for (let [tx, ty] of tetromino.rotated(r)) {
        ctx.clearRect(...cell(x + tx, y + ty), ...size(1, 1))
    }
}

const scoreElem = document.getElementById('score')

const tetris = {
    get space() { return this._space },
    set space(value) {
        clear(foreCtx)
        // 設定邊界 (-1, -3) --- (-1, 20) --- (10, 20) --- (10, -3) 
        let x = -1, y = -3
        while (y < height) {
            value.set(x, y++)
        }
        while (x < width) {
            value.set(x++, y)
        }
        while (y >= -3) {
            value.set(x, y--)
        }
        this._space = value
        this.nCellsInRows.fill(0)
        this.tetromino = this.nextTetromino
        this.holdTetromino = null
        this.nextTetromino = tetrominoIter.next().value
    },
    // dropPoint: Array[r][x+2][y]
    dropPoint: Array.from({ length: 4 }, _ => new Array(width + 1)),
    // nCellsInRows: Array[y+3]，紀錄 row 放了幾個 cell
    nCellsInRows: new Array(height + 3 + 1),
    isNotCollision(x, y, r) {
        return !this.tetromino.rotated(r).cells().some(([tx, ty]) => this.space.has(x + tx, y + ty))
    },
    // cursor: [x, y, r]
    // 依右手定則，r 對應方向，右: 0, 上: 1, 左: 2, 下: 3
    get cursor() { return this.space.center },
    set cursor([x, y, r]) {
        r = r & 3
        let d = this.dropPoint[r][x + 2]
        let [x0, y0, r0] = this.cursor
        let d0 = this.dropPoint[r0][x0 + 2]
        if (d <= y) {
            for (d = y; this.isNotCollision(x, d + 1, r); ++d) { }
            this.dropPoint[r][x + 2] = d
        }
        clearTetromino(foreCtx, x0, y0, r0, this.tetromino)
        if (x != x0 || d != d0 || r != r0) {
            clearTetromino(foreCtx, x0, d0, r0, this.tetromino)
            fillTetromino(foreCtx, x, d, r, this.tetromino, 'light')
        }
        fillTetromino(foreCtx, x, y, r, this.tetromino)
        this.space.center = [x, y, r]
    },
    get tetromino() { return this._tetromino },
    set tetromino(value) {
        this.dropPoint.forEach(array => array.fill(-4))
        // tetromino 生成指標 [x, y, r]，基於 tetromino 的 space 而偏移
        this.space.center = [(width >> 1) - 2, -4, 0]
        this._tetromino = value
        this.cursor = this.space.center
    },
    held: false,
    get holdTetromino() { return this._holdTetromino },
    set holdTetromino(value) {
        clear(holdCtx)
        if (value == null) {
            this.held = false
        } else if (this._holdTetromino != null) {
            let [x, y, r] = this.cursor
            let d = this.dropPoint[r][x + 2]
            clearTetromino(foreCtx, x, y, r, this.tetromino)
            clearTetromino(foreCtx, x, d, r, this.tetromino)
            fillTetromino(holdCtx, 0, 0, 0, value)
            this.held = true
        }
        this._holdTetromino = value
    },
    get nextTetromino() { return this._nextTetromino },
    set nextTetromino(value) {
        clear(nextCtx)
        fillTetromino(nextCtx, 0, 0, 0, value)
        this._nextTetromino = value
    },
    get delay() {
        return 1000
    },
    get score() { return this._score },
    set score(value) {

    },
    clearTimeout: _ => { },
    setTimeout(ms) {
        return new Promise((res, rej) => {
            this.clearTimeout = rej
            setTimeout(res, ms)
        })
    },
    lock(reason) {
        this.clearTimeout(reason)
        onkeydown.inactive.push('tab', 'arrowdown', 'arrowleft', 'arrowright', 'q', 'w', ' ')
    },
    async run(asynfunc, onFinally) {
        this.lock()
        try {
            await asynfunc().finally(onFinally)
            this.run(async _ => {
                onkeydown.inactive.length = 0
                if (movedown() == 'Died') {
                    throw 'Died'
                }
                await this.setTimeout(this.delay)
            })
        } catch (error) {
            console.log('\x1b[31mtetris.run Caught:', error)
        }
    },
}

var onkeydown = event => {
    let key = event.key.toLowerCase()
    if (onkeydown[key] && !onkeydown.inactive.includes(key)) {
        event.preventDefault()
        // 如果沒做什麼，會回傳 true，詳: listener = event => event.repeat || value()
        onkeydown[key](event) || console.log('\x1b[33monkeydown:', key)
    }
}

// 提示 onkeydown 的 properties，哪些 key 對應 clickable element
Object.assign(onkeydown, {
    'tab': undefined,
    'arrowdown': undefined,
    'arrowleft': undefined,
    'arrowright': undefined,
    'q': undefined,
    'w': undefined,
    ' ': undefined,
    'n': document.getElementById('new-game'),
    'enter': document.getElementById('enter'),
    inactive: [],
})

for (let [key, elem] of Object.entries(onkeydown)) {
    if (!(elem instanceof Element)) {
        continue
    }
    // 將相應的 onkeydown, onclick, DOM element 綁在一起 
    let listener
    Object.defineProperty(onkeydown, key, {
        get() { return listener },
        set(value) {
            if (typeof value == 'object') {
                value = Object.values(value).pop()
            }
            // 剛好 clickable element 都不需要 auto-repeat 
            listener = event => event.repeat || value()
            elem.onclick = value
            elem.children[1].textContent = value.name
        },
    })
    // DOM element 透過 onkeydown, onkeyup 模仿出 :active pseudo-class
    // 一旦 blur，onkeyup 時，event 不會傳來
    addEventListener('keydown', event => event.key.toLowerCase() == key && elem.classList.add('active'))
    addEventListener('keyup', event => event.key.toLowerCase() == key && elem.classList.remove('active'))
    addEventListener('blur', event => event && elem.classList.remove('active'))
}

onkeydown['tab'] = _ => {
    if (tetris.held) {
        fillTetromino(holdCtx, 0, 0, 0, tetris.holdTetromino, 'light')
        setTimeout(fillTetromino, 200, holdCtx, 0, 0, 0, tetris.holdTetromino)
        return
    }
    if (tetris.holdTetromino == null) {
        tetris.holdTetromino = tetris.nextTetromino
        tetris.nextTetromino = tetrominoIter.next().value
    }
    [tetris.holdTetromino, tetris.tetromino] = [tetris.tetromino, tetris.holdTetromino]
}

onkeydown['arrowdown'] = movedown

onkeydown['arrowleft'] = _ => {
    let [x, y, r] = tetris.cursor
    x -= 1
    if (tetris.isNotCollision(x, y, r)) {
        tetris.cursor = [x, y, r]
    }
}

onkeydown['arrowright'] = _ => {
    let [x, y, r] = tetris.cursor
    x += 1
    if (tetris.isNotCollision(x, y, r)) {
        tetris.cursor = [x, y, r]
    }
}

onkeydown['q'] = _ => {
    let [x, y, r] = tetris.cursor
    r -= 1
    if (tetris.isNotCollision(x, y, r)) {
        tetris.cursor = [x, y, r]
    } else if (tetris.isNotCollision(x - 1, y, r)) {
        tetris.cursor = [--x, y, r]
    } else if (tetris.isNotCollision(x + 1, y, r)) {
        tetris.cursor = [++x, y, r]
    } else if (tetris.isNotCollision(x, y + 1, r)) {
        tetris.cursor = [x, ++y, r]
    } else if (tetris.isNotCollision(x - 1, y + 1, r)) {
        tetris.cursor = [--x, ++y, r]
    } else if (tetris.isNotCollision(x + 1, y + 1, r)) {
        tetris.cursor = [++x, ++y, r]
    }
}

onkeydown['w'] = _ => {
    let [x, y, r] = tetris.cursor
    r += 1
    if (tetris.isNotCollision(x, y, r)) {
        tetris.cursor = [x, y, r]
    } else if (tetris.isNotCollision(x + 1, y, r)) {
        tetris.cursor = [++x, y, r]
    } else if (tetris.isNotCollision(x - 1, y, r)) {
        tetris.cursor = [--x, y, r]
    } else if (tetris.isNotCollision(x, y + 1, r)) {
        tetris.cursor = [x, ++y, r]
    } else if (tetris.isNotCollision(x + 1, y + 1, r)) {
        tetris.cursor = [++x, ++y, r]
    } else if (tetris.isNotCollision(x - 1, y + 1, r)) {
        tetris.cursor = [--x, ++y, r]
    }
}

onkeydown[' '] = _ => {
    let [x, y, r] = tetris.cursor
    let d = tetris.dropPoint[r][x + 2]
    tetris.cursor = [x, d, r]
    movedown()
}

onkeydown['n'] = {
    'new game'() {
        reset()
        play()
    }
}

function movedown() {
    let [x, y, r] = tetris.cursor
    if (tetris.dropPoint[r][x + 2] != y) {
        tetris.cursor = [x, ++y, r]
        return
    }
    if (y == -4) {
        return die()
    }
    // cells 著地
    let nfulls = 0
    for (let [tx, ty] of tetris.tetromino.rotated(r)) {
        tetris.space.set(x + tx, y + ty)
        tetris.nCellsInRows[y + ty + 3] += 1
        if (tetris.nCellsInRows[y + ty + 3] == width) {
            nfulls += 1
        }
    }
    // 找出放滿的 row，計算各 row 平移到哪 row，同時平移 nCellsInRows
    // fulls: Array[y], shiftMap: y0 => y
    let fulls = []
    let shiftMap = new Array(height + 3 + 1)
    let topmost = height
    if (nfulls) {
        for (let j = height; j > -4; --j) {
            if (tetris.nCellsInRows[j + 3] == width) {
                fulls.push(j)
                shiftMap[j] = fulls.length - 4
            } else {
                tetris.nCellsInRows[fulls.length + j + 3] = tetris.nCellsInRows[j + 3]
                shiftMap[j] = fulls.length + j
            }
            if (tetris.nCellsInRows[j + 3]) {
                topmost -= 1
            }
        }
        tetris.nCellsInRows.fill(0, 0, fulls.length)
        // cells 消除
        let cells = tetris.space.cells().map(([tx, ty]) => [tx, shiftMap[ty]])
        tetris.space.clear()
        cells.forEach(cell => tetris.space.set(...cell))
        for (let i = 0; i < width; ++i) {
            for (let j = 0; j < nfulls; ++j) {
                tetris.space.delete(i, j - 3)
            }
        }
    }
    tetris.run(async _ => {
        // 著地動畫
        fillTetromino(foreCtx, x, y, r, tetris.tetromino, 'light')
        await tetris.setTimeout(200)
        fillTetromino(foreCtx, x, y, r, tetris.tetromino)
        if (!nfulls) {
            return
        }
        await tetris.setTimeout(200)
        // 消除動畫
        let lines = Array.from(fulls, fy => foreCtx.getImageData(...cell(0, fy), ...size(width, 1)))
        fulls.forEach(fy => foreCtx.clearRect(...cell(0, fy), ...size(width, 1)))
        await tetris.setTimeout(200)
        fulls.forEach((fy, i) => foreCtx.putImageData(lines[i], ...cell(0, fy)))
        await tetris.setTimeout(200)
    }, _ => {
        // 著地繪製
        fillTetromino(foreCtx, x, y, r, tetris.tetromino)
        // 消除繪製
        fulls.forEach(fy => foreCtx.clearRect(...cell(0, fy), ...size(width, 1)))
        fulls.push(topmost - 1)
        for (let j = 0; j < nfulls; ++j) {
            let bottom = fulls[j]
            let top = fulls[j + 1] + 1
            if (bottom - top) {
                let toShift = foreCtx.getImageData(...cell(0, top), ...size(width, bottom - top))
                foreCtx.putImageData(toShift, ...cell(0, top + shiftMap[bottom] + 4))
            }
        }
        foreCtx.clearRect(...cell(0, topmost), ...size(width, nfulls))
        tetris.tetromino = tetris.nextTetromino
        tetris.held = false
        tetris.nextTetromino = tetrominoIter.next().value
    })
}

// 依右手定則，1: 逆時針, -1: 順時針
function rotate(x, y, r) {
    if (tetris.isNotCollision(x, y, r)) {
        tetris.cursor = [x, y, r]
    } else if (tetris.isNotCollision(x - 1, y, r)) {
        tetris.cursor = [--x, y, r]
    } else if (tetris.isNotCollision(x + 1, y, r)) {
        tetris.cursor = [++x, y, r]
    } else {
        return false
    }
    return true
}

async function countdown() {
    for (let i = 3; i; --i) {
        console.log(i)
        await tetris.setTimeout(1000)
    }
    console.log(0)
}

function reset() {
    onkeydown['enter'] = play
    tetris.lock('Reset')
    tetris.nextTetromino = tetrominoIter.next().value
}

function die() {
    tetris.run(async _ => {
        await tetris.setTimeout(1000)
        reset()
        throw 'Returns by Death'
    })
    return 'Died'
}

function play() {
    tetris.run(async _ => {
        await countdown()
        onkeydown['enter'] = pause
        tetris.space = new Space()
        foreCanvas.hidden = false
    })
}

function resume() {
    tetris.run(async _ => {
        await countdown()
        onkeydown['enter'] = pause
        foreCanvas.hidden = false
        await tetris.setTimeout(tetris.delay >> 1)
    })
}

function pause() {
    onkeydown['enter'] = resume
    foreCanvas.hidden = true
    tetris.lock('Pause')
}

reset()
