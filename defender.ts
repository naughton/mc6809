/// <reference path="Scripts/typings/jquery/jquery.d.ts" />
/// <reference path="mc6809.ts" />

var game;

window.onload = () => {
    game = new Defender.Game();
};

window.performance = window.performance || {};
performance.now = (() => performance.now ||
    performance.mozNow ||
    performance.msNow ||
    performance.oNow ||
    performance.webkitNow ||
    Date.now)();

module Defender {

    export class Game {
        private pendingRomLoads = 0;
        private bank = 0;
        private cpu: mc6809.Emulator;
        private canvas: HTMLCanvasElement;
        public ctx: CanvasRenderingContext2D;
        private imageData: ImageData;
        private w: number;
        private h: number;
        private debugTxt: HTMLDivElement;
        private timeTxt: HTMLDivElement;
        private breakpoint: HTMLInputElement;
        private pallete: number[][] = [
            [0, 0, 0], [0xff, 0xff, 0xff], [0xff, 0xff, 0xff], [0xff, 0xff, 0xff],
            [0xff, 0xff, 0xff], [0xff, 0xff, 0xff], [0xff, 0xff, 0xff], [0xff, 0xff, 0xff],
            [0xff, 0xff, 0xff], [0xff, 0xff, 0xff], [0xff, 0xff, 0xff], [0xff, 0xff, 0xff],
            [0xff, 0xff, 0xff], [0xff, 0xff, 0xff], [0xff, 0xff, 0xff], [0xff, 0xff, 0xff]
        ];
        private roms: mc6809.ROM[] = [
            new mc6809.ROM("defender/defend.1", new mc6809.MemBlock(0xd000, 0x0800, null, null)),
            new mc6809.ROM("defender/defend.4", new mc6809.MemBlock(0xd800, 0x0800, null, null)),
            new mc6809.ROM("defender/defend.2", new mc6809.MemBlock(0xe000, 0x1000, null, null)),
            new mc6809.ROM("defender/defend.3", new mc6809.MemBlock(0xf000, 0x1000, null, null)),
            // bank 1
            new mc6809.ROM("defender/defend.9", new mc6809.MemBlock(0x1000, 0x0800, null, null)),
            new mc6809.ROM("defender/defend.12", new mc6809.MemBlock(0x1800, 0x0800, null, null)),
            // bank 2
            new mc6809.ROM("defender/defend.8", new mc6809.MemBlock(0x2000, 0x0800, null, null)),
            new mc6809.ROM("defender/defend.11", new mc6809.MemBlock(0x2800, 0x0800, null, null)),
            // bank 3
            new mc6809.ROM("defender/defend.7", new mc6809.MemBlock(0x3000, 0x0800, null, null)),
            new mc6809.ROM("defender/defend.10", new mc6809.MemBlock(0x3800, 0x0800, null, null)),
            // bank 7
            new mc6809.ROM("defender/defend.6", new mc6809.MemBlock(0x7000, 0x0800, null, null))
        ];

        private KEY_CODES = {
            32: 'space',
            37: 'left',
            38: 'up',
            39: 'right',
            40: 'down',
            112: 'F1',
            113: 'F2',
            114: 'F3',
            115: 'F4',
            116: 'F5',
            117: 'F6'
        }

        private KEY_STATUS = {
            keyDown: false
        };

        constructor() {
            this.bank = 0;
            this.cpu = new mc6809.Emulator();
            $.each(this.roms, (i, rom) => {
                this.load(rom);
            });
            this.canvas = <HTMLCanvasElement>document.getElementById('mainCanvas');
            this.debugTxt = <HTMLDivElement>document.getElementById('debugTxt');
            this.timeTxt = <HTMLDivElement>document.getElementById('timeTxt');
            this.debugTxt.innerText = "foobar";
            this.breakpoint = <HTMLInputElement>document.getElementById('breakpoint');
            this.ctx = this.canvas.getContext('2d');
            this.ctx.imageSmoothingEnabled = false;
            this.ctx.mozImageSmoothingEnabled = false;
            this.ctx.webkitImageSmoothingEnabled = false;
            // read the width and height of the canvas
            this.w = this.canvas.width;
            this.h = this.canvas.height;
            this.imageData = this.ctx.createImageData(this.w, this.h);

            for (var code in this.KEY_CODES) {
                this.KEY_STATUS[this.KEY_CODES[code]] = false;
            }

            $(window).keydown((e) => {
                this.KEY_STATUS.keyDown = true;
                if (this.KEY_CODES[e.keyCode]) {
                    e.preventDefault();
                    this.KEY_STATUS[this.KEY_CODES[e.keyCode]] = true;
                }
            }).keyup((e) => {
                    this.KEY_STATUS.keyDown = false;
                    if (this.KEY_CODES[e.keyCode]) {
                        e.preventDefault();
                        this.KEY_STATUS[this.KEY_CODES[e.keyCode]] = false;
                    }
                });
        }

        private allRomsLoaded = () => {
            var ram = new mc6809.MemBlock(0x0000, 0xc000, null, null);
            var rom = new mc6809.MemBlock(0xd000, 0x3000, null, null);
            var bank = new mc6809.MemBlock(0xc000, 0x1000, this.bankRead, this.bankWrite);
            var page = new mc6809.MemBlock(0xd000, 1, this.bankSelectRead, this.bankSelectWrite);

            var mmap = [ram, rom, bank, page];
            this.cpu.setMemoryMap(mmap);

            this.cpu.setStackAddress(0xbfff);
            this.cpu.reset();
            this.dump();
        }
        
        private ioWrite = (addr: number, val: number): void=> {
            switch (addr) {
                case 0xc010:
                    console.log("Screen Control:" + val);
                    console.log(this.cpu.state());
                    break;
                case 0xc3fc:
                    // console.log("Watchdog:" + addr.toString(16) + " -> " + val.toString(16));
                    break;
                case 0xc800: // 6 bits of the video counters bits 2-7
                    console.log("Video Counters: " + val.toString(16));
                    console.log(this.cpu.state());
                    break;
                default:
                    if (addr >= 0xc000 && addr <= 0xc00f) {
                        var colorindex = (addr - 0xc000);
                        // BBGGGRRR
                        var b = Math.round(255 * ((val >> 6) & 3) / 4);
                        var g = Math.round(255 * ((val >> 3) & 7) / 8);
                        var r = Math.round(255 * (val & 7) / 8);
                        var pixel = [r, g, b];
                        console.log("Set color palette(" + colorindex + ") = " + pixel);
                        this.pallete[colorindex] = pixel;
                    } else if (addr >= 0xc400 && addr <= 0xc5ff) {
                        // var cmosaddr = (addr - 0xc400);
                        //console.log('CMOS RAM(' + cmosaddr + ') = ' + val);

                    } else if (addr >= 0xcc00 && addr <= 0xccff) {
                        this.piaWrite(addr - 0xcc00, val);
                    } else {
                        console.log("IO write " + val + " to " + addr.toString(16));
                        console.log(this.cpu.state());
                    }
            }
        }

        private piaWrite = (index: number, val: number) => {
            switch (index) {
                case 1:
                    console.log('PIA 1A <- ' + val);
                    break;
                case 3:
                    // cc03 pia1_ctrlb (CB2 select between player 1 and player 2 controls if Table)
                    console.log('PIA 1B <- ' + val);
                    console.log('PLAYER ' + (val + 1));
                    break;
                case 5:
                    // pia2_ctrla
                    console.log('PIA 2A <- ' + val);
                    break;
                case 7:
                    // pia2_ctrlb   Control the IRQ
                    console.log('PIA 2B <- ' + val);
                    console.log('Control the IRQ');
                    break;

                default:
                    console.log('PIA write(' + index + ') = ' + val);
                    break;
            }

            console.log(this.cpu.state());
        }

        private ioRead = (addr: number): number=> {

            switch (addr) {
                case 0xcc00: // cc00 pia1_dataa (widget = I/O board)
                    /*
                      bit 0  Auto Up
                      bit 1  Advance
                      bit 2  Right Coin
                      bit 3  High Score Reset
                      bit 4  Left Coin
                      bit 5  Center Coin
                    */
                    var autoup = this.KEY_STATUS['1'];
                    var advance = this.KEY_STATUS['2'];
                    var rightcoin = this.KEY_STATUS['3'];
                    var highscorereset = this.KEY_STATUS['4'];
                    var leftcoin = this.KEY_STATUS['5'];
                    var centercoin = this.KEY_STATUS['6'];

                    var pia1_dataa = centercoin << 5 | leftcoin << 4 | highscorereset << 3 | rightcoin << 2 | advance << 1 | autoup;
                    //if (pia1_dataa != 0)
                    //   console.log("returning pia1_dataa = " + pia1_dataa.toString(16));
                    return pia1_dataa;
                default:
                    console.log("PIO read from " + addr.toString(16));
                    console.log(this.cpu.state());
                    return 0;
            }
        }

        private bankWrite = (addr: number, val: number): void=> {
            if (this.bank == 0) {
                this.ioWrite(addr, val);
            } else {
                console.log("writing " + val + " to address " + addr.toString(16) + " while on bank #" + this.bank);
                console.log(this.cpu.state());
                this.halt();
            }
        }

        private bankRead = (addr: number): number=> {
            if (this.bank == 0) {
                return this.ioRead(addr);
            }
            var offset = (this.bank * 0x1000) + (addr & 0x0fff);
            return this.cpu.readByteROM(offset);
        }

        private bankSelectWrite = (addr: number, val: number): void=> {
            //    console.log("Bank Select: " + val + ' called from ' + this.cpu.regPC.toString(16));
            //    console.log(this.cpu.state());
            this.bank = val;
        }
        private bankSelectRead = (addr: number): number=> {
            console.log("Bank Read: " + this.bank + " addr: " + addr.toString(16) + ' called from ' + this.cpu.regPC.toString(16));
            //console.log(this.cpu.state());
            return this.bank;
        }

        private load = (rom: mc6809.ROM) => {
            this.pendingRomLoads++;
            var xhr = new XMLHttpRequest();
            xhr.open('GET', rom.name, true);
            xhr.responseType = 'arraybuffer';
            xhr.onreadystatechange = () => {
                if (xhr.readyState == 4 && xhr.status == 200) {
                    var r = xhr.response;
                    var bytes = new Uint8Array(r);
                    this.cpu.loadMemory(bytes, rom.mem.start);
                    console.log('loaded ' + bytes.length +
                        ' bytes from ' + rom.name + ' into ' + rom.mem.start.toString(16));
                    this.pendingRomLoads--;
                    if (this.pendingRomLoads == 0) {
                        this.allRomsLoaded();
                    }
                }
            };
            xhr.send();
        }

        private dump = () => {
            this.debugTxt.innerHTML = '<pre>' + this.cpu.state() + '</pre>';

            this.blit();
        }

        public step = (n: number): void=> {
            this.cpu.execute(n, 0, undefined); // no interrupts
            this.dump();
        }

        public run = (): void=> {
            //console.log("run...");
            var start = performance.now();
            var bp: number = undefined;
            if (this.breakpoint.value.length > 0) {
                bp = parseInt(this.breakpoint.value, 16);
            }
            this.cpu.execute(100000, 0, bp); // No interrupts...
            var took = performance.now() - start;
            this.timeTxt.innerText = took.toFixed(1);
            //console.log("took " + took);
            this.dump();
            if (!this.cpu.halted)
                setTimeout(this.run, 100);
        }

        public halt = (): void=> {
            this.cpu.halt();
        }
        public debug = (): void=> {
            this.cpu.toggleDebug();
        }

        /// The display is 304 x 256 pixels, using 16 colors at a time out of a hardware palette of 256.
        /// The byte at memory location $0000 in the upper left-hand corner of the screen.
        /// 4 bits are used for each pixel, so that byte displays as 2 pixels, side by side.
        /// The value of the 4 bits is used to offset into a lookup table, and the contents of that location
        /// in the table determine the color displayed for that pixel.
        /// Memory location $0001 displays as 2 pixels immediately below, $0002 is below that one, etc.
        /// The bottom left corner of the screen is memory location $00FF.
        /// Memory location $0100 displays the 3rd and 4th pixels in the top line.
        /// Note that the monitor may not display all the pixels, depending on how it is set up.
        /// Generally the top and bottom of the display are adjusted off the screen with overscan.
        public blit = (): void=> {
            var w = 304 / 2;
            var h = 256;
            var id = this.imageData;
            var pal = this.pallete;
            var m = this.cpu.mem;
            var data = id.data;
            var scanlineoffset = id.width * 4;
            var addr = 0x10000;
            var colindex = 0;
            for (var x = 0; x < w; x++) {
                var index = colindex;
                for (var y = 0; y < h; y++) {
                    var two = m[addr++];
                    var p = pal[(two >> 4) & 0xf];
                    data[index] = p[0];
                    data[index + 1] = p[1];
                    data[index + 2] = p[2];
                    data[index + 3] = 0xff;
                    p = pal[two & 0xf];
                    data[index + 4] = p[0];
                    data[index + 5] = p[1];
                    data[index + 6] = p[2];
                    data[index + 7] = 0xff;
                    index += scanlineoffset;
                }
                colindex += 8; // move right two pixels.
            }
            this.ctx.putImageData(this.imageData, 0, 0);
        }
    }
}

/*
    Defender
    --------
    0000-9800 Video RAM
    C000-CFFF ROM (4 banks) + I/O
    d000-ffff ROM

    c000-c00f color_registers  (16 bytes of BBGGGRRR)

    C3FC      WatchDog

    C400-C4FF CMOS ram battery backed up

    C800      6 bits of the video counters bits 2-7

    cc00 pia1_dataa (widget = I/O board)
      bit 0  Auto Up
      bit 1  Advance
      bit 2  Right Coin
      bit 3  High Score Reset
      bit 4  Left Coin
      bit 5  Center Coin
      bit 6
      bit 7
    cc01 pia1_ctrla

    cc02 pia1_datab
      bit 0 \
      bit 1 |
      bit 2 |-6 bits to sound board
      bit 3 |
      bit 4 |
      bit 5 /
      bit 6 \
      bit 7 /Plus CA2 and CB2 = 4 bits to drive the LED 7 segment
    cc03 pia1_ctrlb (CB2 select between player 1 and player 2 controls if Table)

    cc04 pia2_dataa
      bit 0  Fire
      bit 1  Thrust
      bit 2  Smart Bomb
      bit 3  HyperSpace
      bit 4  2 Players
      bit 5  1 Player
      bit 6  Reverse
      bit 7  Down
    cc05 pia2_ctrla

    cc06 pia2_datab
      bit 0  Up
      bit 1
      bit 2
      bit 3
      bit 4
      bit 5
      bit 6
      bit 7
    cc07 pia2_ctrlb
      Control the IRQ

    d000 Select bank (c000-cfff)
      0 = I/O
      1 = BANK 1
      2 = BANK 2
      3 = BANK 3
      7 = BANK 4
*/
