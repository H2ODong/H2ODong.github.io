'use strict'

// 俄羅斯方塊的空間，寬 10 格，高 20 格，單位格子佔畫布 128 單位長
const unitSize = 1 << 7
const width = 10
const height = width << 1
const gapSize = unitSize >> 4

document.documentElement.style.setProperty('--height', height)

// 紀錄佔據 Space 的 cells
// 類似用 Set 存放數對 [x, y]，但是為了有效區別，以 toKey(x, y) 作為 key
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
        return super.has(Space.toKey(x, y))
    }
    set(x, y) {
        return super.set(Space.toKey(x, y), [x, y])
    }
    delete(x, y) {
        return super.delete(Space.toKey(x, y))
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
                this.forEach(([tx, ty]) => rotated.set(x - y + ty, y + x - tx))
                return rotated
            case 2:
                this.forEach(([tx, ty]) => rotated.set(x + x - tx, y + y - ty))
                return rotated
            case 3:
                this.forEach(([tx, ty]) => rotated.set(x + y - ty, y - x + tx))
                return rotated
        }
    }
    static toKey(x, y) {
        return x << 16 | y & 0b1111_1111_1111_1111
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
// 讓出現次數太少的方塊，容易被選到
const tetrominoIter = function* () {
    // 準備一個袋子，7 種俄羅斯方塊各放 4 個
    const bag = [...tetrominoes, ...tetrominoes, ...tetrominoes, ...tetrominoes]
    let n = 10
    // 先隨機選 n 個，放 tetrominoBag 的最後
    for (let k = n; k; --k) {
        let i = bag.length - k
        let j = (i + 1) * Math.random() | 0
        { [bag[i], bag[j]] = [bag[j], bag[i]] }
    }
    // 最後 n 個作為歷史紀錄，排除選擇
    for (let k = n; ; k = k % n + 1) {
        let i = bag.length - k
        let j = (bag.length - n) * Math.random() | 0
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
backCtx.lineWidth = foreCtx.lineWidth = gapSize
nextCtx.lineWidth = holdCtx.lineWidth = gapSize
backCtx.strokeStyle = foreCtx.strokeStyle = '#333'
nextCtx.strokeStyle = holdCtx.strokeStyle = '#333'
// height + 3: 上方需要保留可以凸出去的空間

// getImageData, putImageData 不適用 ctx.translate
// 因此以 cell(x, y) 作為 Linear Transformation
// 而 nextCtx, holdCtx 並沒有凸出去 3 格
// 因此以 ctx.translate 做逆轉換

nextCtx.translate(...size(0, -3))
holdCtx.translate(...size(0, -3))

function cell(x, y) {
    return [x * unitSize, (y + 3) * unitSize]
}

function size(w, h) {
    return [w * unitSize, h * unitSize]
}

// 畫條紋格狀背景
for (let i = 1; i < width; i += 2) {
    backCtx.fillStyle = '#999'
    backCtx.fillRect(...cell(i, 0), ...size(1, height))
    for (let j = 0; j < height; ++j) {
        backCtx.strokeRect(...cell(i, j), ...size(1, 1))
    }
    backCtx.fillStyle = backCtx.strokeStyle
    backCtx.fillRect(...cell(i, 0), ...size(-1, height))
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
    ctx.globalAlpha = light ? .9 : 1
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

const titleElem = document.getElementById('title')
const timerElem = document.getElementById('timer')
const scoreElem = document.getElementById('score')
const linesElem = document.getElementById('lines')
const comboElem = document.getElementById('combo')

function makeTitle(status) {
    status = String(status).replace(/(?:^|\W)./g, char => char.toUpperCase())
    return `${status} | Tetris`
}

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
        this.heldTetromino = null
        this.nextTetromino = tetrominoIter.next().value
        this.score = 0
        this.nlines = 0
    },
    // dropPoint: Array[r][x+2](y)
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
        let [x0, y0, r0] = this.space.center
        let d0 = this.dropPoint[r0][x0 + 2]
        if (d <= y) {
            // 計算落點
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
        this.score += (!!(x - x0) + !!(y - y0) + !!(r - r0)) ** 5 + (y - y0 << 1) - !!(y - y0)
    },
    get tetromino() { return this._tetromino },
    set tetromino(value) {
        this.dropPoint.forEach(array => array.fill(-4))
        // tetromino 生成指標 [x, y, r]
        this.space.center = [(width >> 1) - 2, -4, 0]
        this._tetromino = value
        this.cursor = this.space.center
        // 先賦值在 space.center，前個著地 tetromino 就不會被繪除
        // 該指標是繪製不可見的，所以重複賦值是為了計算落點、繪製落點預測
    },
    held: false,
    get heldTetromino() { return this._heldTetromino },
    set heldTetromino(value) {
        clear(holdCtx)
        if (value == null) {
            this.held = false
        } else if (this._heldTetromino != null) {
            let [x, y, r] = this.cursor
            let d = this.dropPoint[r][x + 2]
            clearTetromino(foreCtx, x, y, r, this.tetromino)
            clearTetromino(foreCtx, x, d, r, this.tetromino)
            fillTetromino(holdCtx, 0, 0, 0, value)
            this.held = true
        }
        this._heldTetromino = value
    },
    get nextTetromino() { return this._nextTetromino },
    set nextTetromino(value) {
        clear(nextCtx)
        fillTetromino(nextCtx, 0, 0, 0, value)
        this._nextTetromino = value
    },
    score: 0,
    combo: 0,
    get nlines() { return this._nlines },
    set nlines(value) {
        if (value == this._nlines || !value) {
            comboElem.style.visibility = 'hidden'
            this.combo = 0
        } else {
            this.combo += value - this._nlines
            comboElem.style.visibility = 'visible'
            comboElem.textContent = this.combo
            comboElem.animate({
                transform: 'scale(1.2) translate(0, -10%)',
                easing: 'ease-out',
            }, 80)
        }
        this._nlines = linesElem.textContent = value
        this.score += 5 * this.combo
    },
    get delay() { return 2048 * (1 + 1 / 16384) ** (-this.score >> 6) + 32 },
    get tick() { return this.delay / 16 + 64 },
    // 涉及原生 setTimeout 的函數，需要有取消的機制
    clearTimeout: _ => { },
    setTimeout(delay) {
        return new Promise((res, rej) => {
            this.clearTimeout = rej
            setTimeout(res, delay)
        })
    },
    lock(reason) {
        this.clearTimeout(reason)
        onkeydown.inactive.push('tab', 'arrowdown', 'arrowleft', 'arrowright', 'q', 'e', ' ')
    },
    // 在進行一些步驟前，取消正在計時的 callback，結束後繼續進行遊戲
    async run(asynfunc, onFinally) {
        this.lock()
        try {
            await asynfunc().finally(onFinally)
            onkeydown.inactive.length = 0
            while (true) {
                switch (movedown()) {
                    case 'Drop':
                        throw 'Drop'
                    case 'Died':
                        throw 'Died'
                }
                await this.setTimeout(this.delay)
            }
        } catch (error) {
            console.log('%cCaught by tetris.run:', 'color: #29B6F6;', error)
        }
    },
}

const timer = {
    startTimestamp: performance.now(),
    pausedTimestamp: performance.now(),
    displayScore: 0,
    displayRatio: 10,
    refreshTimerId: undefined,
    refreshScoreId: undefined,
    play() {
        this.startTimestamp += performance.now() - this.pausedTimestamp
        timerElem.children[1].style.animationIterationCount = 'infinite'
        void function refreshTimer(timestamp) {
            let elapsed = (timestamp - this.startTimestamp) / 1000
            timerElem.children[0].textContent = String(~~(elapsed / 60)).padStart(2, '0')
            timerElem.children[2].textContent = String(~~(elapsed % 60)).padStart(2, '0')
            this.refreshTimerId = requestAnimationFrame(refreshTimer.bind(this))
        }.call(this, performance.now())
    },
    pause() {
        cancelAnimationFrame(this.refreshTimerId)
        this.pausedTimestamp = performance.now()
        timerElem.children[1].style.animationIterationCount = 1
    },
    reset() {
        cancelAnimationFrame(this.refreshTimerId)
        cancelAnimationFrame(this.refreshScoreId)
        this.startTimestamp = this.pausedTimestamp = performance.now()
        this.displayScore = 0
        timerElem.children[1].style.animationIterationCount = 1
        void function refreshScore() {
            let deltaScore = (this.displayRatio * tetris.score << 4) - this.displayScore
            if (deltaScore) {
                this.displayScore += Math.max(deltaScore >> 4, 1)
                scoreElem.textContent = String(this.displayScore >> 4).padStart(8, '0')
            }
            this.refreshScoreId = requestAnimationFrame(refreshScore.bind(this))
        }.call(this)
    },
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
    // 找出並消除放滿的 row，計算各 row 平移到哪 row，同時平移 nCellsInRows
    // fulls: Array(y), shiftMap: y0 => y
    let fulls = []
    let shiftMap = new Array(height + 3 + 1)
    let topmost = height
    if (nfulls) {
        for (let j = height; j > -4; --j) {
            if (tetris.nCellsInRows[j + 3]) {
                topmost -= 1
            }
            if (tetris.nCellsInRows[j + 3] == width) {
                fulls.push(j)
                shiftMap[j] = fulls.length - 4
            } else {
                tetris.nCellsInRows[fulls.length + j + 3] = tetris.nCellsInRows[j + 3]
                shiftMap[j] = fulls.length + j
                continue
            }
            for (let i = 0; i < width; ++i) {
                tetris.space.delete(i, j)
            }
        }
        tetris.nCellsInRows.fill(0, 0, nfulls)
        // cells 消除
        let cells = tetris.space.cells().map(([tx, ty]) => [tx, shiftMap[ty]])
        tetris.space.clear()
        cells.forEach(cell => tetris.space.set(...cell))
    }
    tetris.run(async _ => {
        // 著地動畫
        fillTetromino(foreCtx, x, y, r, tetris.tetromino, 'light')
        await tetris.setTimeout(tetris.tick)
        fillTetromino(foreCtx, x, y, r, tetris.tetromino)
        if (!nfulls) {
            return
        }
        // 消除動畫
        if (nfulls + topmost == 20) {
            titleElem.style.color = 'white'
            titleElem.style.opacity = 1
            titleElem.textContent = 'perfect\nclear'
        }
        await tetris.setTimeout(tetris.tick)
        let lines = fulls.map(fy => foreCtx.getImageData(...cell(0, fy), ...size(width, 1)))
        fulls.forEach(fy => foreCtx.clearRect(...cell(0, fy), ...size(width, 1)))
        await tetris.setTimeout(tetris.tick + 300 * (nfulls + topmost == 20))
        fulls.forEach((fy, i) => foreCtx.putImageData(lines[i], ...cell(0, fy)))
        await tetris.setTimeout(tetris.tick)
    }, _ => {
        // 著地繪製
        fillTetromino(foreCtx, x, y, r, tetris.tetromino)
        // 消除繪製
        titleElem.style.opacity = 0
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
    tetris.nlines += nfulls
    tetris.score += (nfulls && 200 * nfulls - 100) + 40
    tetris.score += 1000 * (nfulls && nfulls + topmost == 20)
    return 'Drop'
}

// t: 依右手定則，1: 逆時針 1/4 圈, -1: 順時針 1/4 圈
function rotate(x, y, r, t) {
    r += t
    if (tetris.isNotCollision(x, y, r)) {
        return tetris.cursor = [x, y, r]
    } else if (tetris.isNotCollision(x - t, y, r)) {
        return tetris.cursor = [x - t, y, r]
    } else if (tetris.isNotCollision(x + t, y, r)) {
        return tetris.cursor = [x + t, y, r]
    }
}

var onkeydown = event => {
    let key = event.key.toLowerCase()
    if (onkeydown[key]) {
        event.preventDefault()
        if (!onkeydown.inactive.includes(key)) {
            // 如果沒做什麼，會回傳 true，詳: listener = event => event.repeat || value()
            onkeydown[key](event) || console.log('%conkeydown:', 'color: #66BB6A;', `[${key}]`)
        }
    }
}

// 提示 onkeydown 的 properties，哪些 key 對應 clickable element
Object.assign(onkeydown, {
    'tab': undefined,
    'arrowdown': undefined,
    'arrowleft': undefined,
    'arrowright': undefined,
    'q': undefined,
    'e': undefined,
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
        fillTetromino(holdCtx, 0, 0, 0, tetris.heldTetromino, 'light')
        setTimeout(fillTetromino, tetris.tick, holdCtx, 0, 0, 0, tetris.heldTetromino)
        // 時間很短，先不處理需要取消的問題
        return
    }
    if (tetris.heldTetromino == null) {
        tetris.heldTetromino = tetris.nextTetromino
        tetris.nextTetromino = tetrominoIter.next().value
    }
    [tetris.heldTetromino, tetris.tetromino] = [tetris.tetromino, tetris.heldTetromino]
    tetris.score += 20
}

onkeydown['arrowdown'] = tetris.run.bind(tetris, async _ => {
    let [x, y, r] = tetris.cursor
    if (tetris.dropPoint[r][x + 2] != y) {
        tetris.cursor = [x, ++y, r]
        onkeydown.inactive.length = 0
        await tetris.setTimeout(tetris.delay)
    }
})

onkeydown['arrowleft'] = _ => {
    let [x, y, r] = tetris.cursor
    if (tetris.isNotCollision(--x, y, r)) {
        tetris.cursor = [x, y, r]
    }
}

onkeydown['arrowright'] = _ => {
    let [x, y, r] = tetris.cursor
    if (tetris.isNotCollision(++x, y, r)) {
        tetris.cursor = [x, y, r]
    }
}

onkeydown['q'] = _ => {
    let [x, y, r] = tetris.cursor
    rotate(x, y, r, 1) || rotate(x, ++y, r, 1)
}

onkeydown['e'] = _ => {
    let [x, y, r] = tetris.cursor
    rotate(x, y, r, -1) || rotate(x, ++y, r, -1)
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

async function countdown() {
    titleElem.style.color = '#29B6F6'
    titleElem.style.opacity = 0
    let animation
    try {
        for (let i = 3; i; --i) {
            titleElem.textContent = i
            document.title = makeTitle(i)
            console.log(i)
            await tetris.setTimeout(200)
            animation = titleElem.animate({ opacity: [1, .1], easing: 'ease-in' }, 800)
            await tetris.setTimeout(800)
        }
    } catch (error) {
        animation?.cancel()
        throw error
    }
    console.log(0)
    document.title = makeTitle('playing')
}

function reset() {
    tetris.lock('Reset')
    onkeydown['enter'] = play
    tetris.nextTetromino = tetrominoIter.next().value
    timer.pause()
}

function die() {
    tetris.run(async _ => {
        titleElem.style.color = '#EF5350'
        titleElem.style.opacity = 1
        titleElem.textContent = 'game\nover'
        document.title = makeTitle('game over')
        titleElem.animate({ opacity: [0, 1] }, 800)
        linesElem.hidden = false
        comboElem.hidden = true
        await tetris.setTimeout(1000)
        reset()
        throw 'Returns by Death'
    })
    return 'Died'
}

function play() {
    tetris.run(async _ => {
        onkeydown['enter'] = pause
        await countdown()
        foreCanvas.hidden = false
        linesElem.hidden = true
        comboElem.hidden = false
    }, _ => {
        tetris.space = new Space()
        timer.reset()
        timer.play()
    })
}

function resume() {
    tetris.run(async _ => {
        onkeydown['enter'] = pause
        await countdown()
        foreCanvas.hidden = false
        linesElem.hidden = true
        comboElem.hidden = false
        onkeydown.inactive.length = 0
        await tetris.setTimeout(tetris.delay / 4)
    }, _ => timer.play())
}

function pause() {
    tetris.run(async _ => {
        await new Promise(res => setTimeout(res))
        onkeydown['enter'] = resume
        titleElem.style.color = '#66BB6A'
        titleElem.style.opacity = 1
        titleElem.textContent = 'pause'
        document.title = makeTitle('paused')
        foreCanvas.hidden = true
        linesElem.hidden = false
        comboElem.hidden = true
        timer.pause()
        throw 'Pause'
    })
}

reset()
