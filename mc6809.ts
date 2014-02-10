/// <reference path="Scripts/typings/jquery/jquery.d.ts" />

module mc6809 {
    enum F {
        CARRY = 1,
        OVERFLOW = 2,
        ZERO = 4,
        NEGATIVE = 8,
        IRQMASK = 16,
        HALFCARRY = 32,
        FIRQMASK = 64,
        ENTIRE = 128
    }

    /* Instruction timing for single-byte opcodes */
    var c6809Cycles: number[] = [
        6, 0, 0, 6, 6, 0, 6, 6, 6, 6, 6, 0, 6, 6, 3, 6,          /* 00-0F */
        0, 0, 2, 4, 0, 0, 5, 9, 0, 2, 3, 0, 3, 2, 8, 6,          /* 10-1F */
        3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3,          /* 20-2F */
        4, 4, 4, 4, 5, 5, 5, 5, 0, 5, 3, 6, 9, 11, 0, 19,        /* 30-3F */
        2, 0, 0, 2, 2, 0, 2, 2, 2, 2, 2, 0, 2, 2, 0, 2,          /* 40-4F */
        2, 0, 0, 2, 2, 0, 2, 2, 2, 2, 2, 0, 2, 2, 0, 2,          /* 50-5F */
        6, 0, 0, 6, 6, 0, 6, 6, 6, 6, 6, 0, 6, 6, 3, 6,          /* 60-6F */
        7, 0, 0, 7, 7, 0, 7, 7, 7, 7, 7, 0, 7, 7, 4, 7,          /* 70-7F */
        2, 2, 2, 4, 2, 2, 2, 0, 2, 2, 2, 2, 4, 7, 3, 0,          /* 80-8F */
        4, 4, 4, 6, 4, 4, 4, 4, 4, 4, 4, 4, 6, 7, 5, 5,          /* 90-9F */
        4, 4, 4, 6, 4, 4, 4, 4, 4, 4, 4, 4, 6, 7, 5, 5,          /* A0-AF */
        5, 5, 5, 7, 5, 5, 5, 5, 5, 5, 5, 5, 7, 8, 6, 6,          /* B0-BF */
        2, 2, 2, 4, 2, 2, 2, 0, 2, 2, 2, 2, 3, 0, 3, 0,          /* C0-CF */
        4, 4, 4, 6, 4, 4, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5,          /* D0-DF */
        4, 4, 4, 6, 4, 4, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5,          /* E0-EF */
        5, 5, 5, 7, 5, 5, 5, 5, 5, 5, 5, 5, 6, 6, 6, 6           /* F0-FF */
    ];

    /* Instruction timing for the two-byte opcodes */
    var c6809Cycles2: number[] = [
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,          /* 00-0F */
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,          /* 10-1F */
        0, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5,          /* 20-2F */
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 20,         /* 30-3F */
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,          /* 40-4F */
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,          /* 50-5F */
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,          /* 60-6F */
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,          /* 70-7F */
        0, 0, 0, 5, 0, 0, 0, 0, 0, 0, 0, 0, 5, 0, 4, 0,          /* 80-8F */
        0, 0, 0, 7, 0, 0, 0, 0, 0, 0, 0, 0, 7, 0, 6, 6,          /* 90-9F */
        0, 0, 0, 7, 0, 0, 0, 0, 0, 0, 0, 0, 7, 0, 6, 6,          /* A0-AF */
        0, 0, 0, 8, 0, 0, 0, 0, 0, 0, 0, 0, 8, 0, 7, 7,          /* B0-BF */
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 0,          /* C0-CF */
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 6, 6,          /* D0-DF */
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 6, 6,          /* E0-EF */
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 7, 7           /* F0-FF */
    ];

    var MEM_ROM: number = 0x00000; /* Offset to first bank (ROM) */
    var MEM_RAM: number = 0x10000; /* Offset to second bank (RAM) */
    var MEM_FLAGS: number = 0x20000; /* Offset to flags in memory map */
    /* Pending interrupt bits */
    var INT_NMI: number = 1;
    var INT_FIRQ: number = 2;
    var INT_IRQ: number = 4;

    function makeSignedByte(x: number): number {
        return x << 24 >> 24;
    }

    function makeSignedWord(x: number): number {
        return x << 16 >> 16;
    }

    function SET_V8(a: number, b: number, r: number): number {
        // TODO: might need to mask & 0xff each param.
        return (((a ^ b ^ r ^ (r >> 1)) & 0x80) >> 6);
    }

    function SET_V16(a: number, b: number, r: number): number {
        // TODO: might need to mask & 0xffff each param.
        return (((a ^ b ^ r ^ (r >> 1)) & 0x8000) >> 14);
    }

    export class MemBlock {
        start: number;
        len: number;
        read: { (addr: number): number; };
        write: { (addr: number, val: number): void; };
        constructor(start: number,
            len: number,
            read: { (addr: number): number; },
            write: { (addr: number, val: number): void; }) {
            this.start = start;
            this.len = len;
            this.read = read;
            this.write = write;
        }
    }

    export class ROM {
        name: string;
        mem: MemBlock;
        constructor(name: string, mem: MemBlock) {
            this.name = name;
            this.mem = mem;
        }
    }

    export class Emulator {
        private regX: number;
        private regY: number;
        private regU: number;
        public regS: number;
        public regPC: number;
        private regA: number; // byte
        private regB: number; // byte

        private getRegD = (): number=> {
            return 0xffff & (this.regA << 8 | this.regB & 0xff);
        }
        private setRegD = (value: number): void=> {
            this.regB = value & 0xff;
            this.regA = (value >> 8) & 0xff;
        }
        private regDP: number; // byte
        private regCC: number; // byte

        private stackAddress: number; // address to set regS to on reset.
        private iClocks: number;
        private buffer: ArrayBuffer;
        public mem: Uint8Array;
        private view: DataView;

        public pcCount: number = 0;

        private memHandler: MemBlock[] = [];
        public counts = {};
        public inorder = [];


        public debug: boolean = false;
        public hex = (v: number, width: number): string=> {
            var s = v.toString(16);
            if (!width) width = 2;
            while (s.length < width) {
                s = '0' + s;
            }
            return s;
        }

        public stateToString = (): string=> {
            return 'pc:' + this.hex(this.regPC, 4) +
                ' s:' + this.hex(this.regS, 4) +
                ' u:' + this.hex(this.regU, 4) +
                ' x:' + this.hex(this.regX, 4) +
                ' y:' + this.hex(this.regY, 4) +
                ' a:' + this.hex(this.regA, 2) +
                ' b:' + this.hex(this.regB, 2) +
                ' d:' + this.hex(this.getRegD(), 4) +
                ' dp:' + this.hex(this.regDP, 2) +
                ' cc:' + this.flagsToString();
        }

        public nextOp = (): string => {
            var pc = this.regPC;

            var nextop = this.M6809ReadByte(pc);
            var mn = this.mnemonics;
            if (nextop == 0x10) {
                mn = this.mnemonics10;
                nextop = this.M6809ReadByte(++pc);
            } else if (nextop == 0x11) {
                mn = this.mnemonics11;
                nextop = this.M6809ReadByte(++pc);
            }
            return mn[nextop];
        }


        public state = (): string=> {
            var pc = this.regPC;

            var nextop = this.M6809ReadByte(pc);
            var mn = this.mnemonics;
            if (nextop == 0x10) {
                mn = this.mnemonics10;
                nextop = this.M6809ReadByte(++pc);
            } else if (nextop == 0x11) {
                mn = this.mnemonics11;
                nextop = this.M6809ReadByte(++pc);
            }

            var ret = this.hex(pc, 4) + ' ' +
                mn[nextop] + ' ' +
                this.hex(this.readByteROM(pc + 1), 2) + ' ' +
                this.hex(this.readByteROM(pc + 2), 2) + ' ';

            ret +=
            ' s:' + this.hex(this.regS, 4) +
            ' u:' + this.hex(this.regU, 4) +
            ' x:' + this.hex(this.regX, 4) +
            ' y:' + this.hex(this.regY, 4) +
            ' a:' + this.hex(this.regA, 2) +
            ' b:' + this.hex(this.regB, 2) +
            ' d:' + this.hex(this.getRegD(), 4) +
            ' dp:' + this.hex(this.regDP, 2) +
            ' cc:' + this.flagsToString() +
            '  [' + this.pcCount + ']';

            return ret;
        }

        public flagsToString = (): string=> {
            return ((this.regCC & F.NEGATIVE) ? 'N' : '-') +
                ((this.regCC & F.ZERO) ? 'Z' : '-') +
                ((this.regCC & F.CARRY) ? 'C' : '-') +
                ((this.regCC & F.IRQMASK) ? 'I' : '-') +
                ((this.regCC & F.HALFCARRY) ? 'H' : '-') +
                ((this.regCC & F.OVERFLOW) ? 'V' : '-') +
                ((this.regCC & F.FIRQMASK) ? 'C' : '-') +
                ((this.regCC & F.ENTIRE) ? 'E' : '-');
        }

        public execute = (iClocks: number, interruptRequest: number, breakpoint: number): void=> {
            this.iClocks = iClocks;
            if (breakpoint) {
                console.log("breakpoint set: " + breakpoint.toString(16));
            }

            while (this.iClocks > 0) /* Execute for the amount of time alloted */ {

                if (breakpoint && this.regPC == breakpoint) {
                    console.log('hit breakpoint at ' + breakpoint.toString(16));
                    this.halt();
                    break;
                }

                interruptRequest = this.handleIRQ(interruptRequest);

                var mn = this.nextOp();
                if (this.counts.hasOwnProperty(mn)) {
                    this.counts[mn]++;
                } else {
                    this.inorder.push(mn);
                    this.counts[mn] = 1;
                }


                var ucOpcode = this.nextPCByte();
                this.iClocks -= c6809Cycles[ucOpcode]; /* Subtract execution time */
                if (this.debug)
                    console.log((this.regPC - 1).toString(16) + ': ' + this.mnemonics[ucOpcode]);


                var instruction = this.instructions[ucOpcode];
                if (instruction == null) {
                    console.log('*** illegal opcode: ' + ucOpcode.toString(16) + ' at ' + (this.regPC - 1).toString(16));
                    this.iClocks = 0;
                    this.halt();
                } else {
                    instruction();

                }
            }
        }

        constructor() {
            this.buffer = new ArrayBuffer(0x30000);
            this.mem = new Uint8Array(this.buffer);
            this.view = new DataView(this.buffer, 0);
            this.init11();
        }
        
        public readByteROM = (addr: number): number=> {
            var ucByte = this.mem[MEM_ROM + addr];
            // console.log("Read ROM: " + addr.toString(16) + " -> " + ucByte.toString(16));
            return ucByte;
        }

        public reset = (): void=> {
            this.regX = 0;
            this.regY = 0;
            this.regU = 0;
            this.regS = this.stackAddress;
            this.regA = 0;
            this.regB = 0;
            this.regDP = 0;
            this.regCC = F.FIRQMASK | F.IRQMASK;
            this.regPC = (this.readByteROM(0xfffe) << 8) | this.readByteROM(0xffff);
        }

        public setStackAddress = (addr: number): void=> {
            this.stackAddress = addr;
        }

        public loadMemory = (bytes: Uint8Array, addr: number): void=> {
            this.mem.set(bytes, addr);
        }

        public setMemoryMap = (map: MemBlock[]) => {
            $.each(map, (index, block) => {
                for (var i = 0; i < block.len; i++) {
                    this.mem[MEM_FLAGS + block.start + i] = index;
                }
                if (index > 1) {
                    this.memHandler.push(block);
                }
            });
        }



        public halted: boolean = false;
        public halt = () => {
            this.halted = true;
            this.iClocks = 0;
            console.log("halted.");
        }

        private nextPCByte = (): number => {
            this.pcCount++;
            return this.M6809ReadByte(this.regPC++);
        }
        // var usAddr = this.M6809ReadWord\(this.regPC\);\s+this.regPC \+= 2;

        private nextPCWord = (): number => {
            var word = this.M6809ReadWord(this.regPC);
            this.regPC += 2;
            this.pcCount += 2;
            return word;
        }


        private M6809ReadByte = (addr: number): number=> {
            var c = this.mem[addr + MEM_FLAGS]; /* If special flag (ROM or hardware) */
            switch (c) {
                case 0: /* Normal RAM */
                    var ucByte = this.mem[addr + MEM_RAM];
                    // console.log("Read RAM: " + addr.toString(16) + " -> " + ucByte.toString(16));
                    return ucByte; /* Just return it */
                case 1: /* Normal ROM */
                    var ucByte = this.mem[addr + MEM_ROM];
                    //  console.log("Read ROM: " + addr.toString(16) + " -> " + ucByte.toString(16));
                    return ucByte; /* Just return it */
                default: /* Call special handler routine for this address */
                    var handler = this.memHandler[c - 2];
                    if (handler == undefined) {
                        console.log('need read handler at ' + (c - 2));
                        return 0;
                    }
                    return handler.read(addr);
            }
        }
        
        private M6809WriteByte = (addr: number, ucByte: number): void=> {
            var c = this.mem[addr + MEM_FLAGS]; /* If special flag (ROM or hardware) */
            switch (c) {
                case 0: /* Normal RAM */
                    // console.log("Write RAM: " + addr.toString(16) + " = " + (ucByte & 0xff).toString(16));
                    this.mem[addr + MEM_RAM] = ucByte & 0xff;
                    break;
                case 1: /* Normal ROM - nothing to do */

                    console.log("******** Write ROM: from PC: " + this.regPC.toString(16) + "   " + addr.toString(16) + " = " + (ucByte & 0xff).toString(16));
                    this.mem[addr + MEM_ROM] = ucByte & 0xff; // write it to ROM anyway...
                    break;
                default: /* Call special handler routine for this address */
                    var handler = this.memHandler[c - 2];
                    if (handler == undefined) {
                        console.log('need write handler at ' + (c - 2));
                    } else
                        handler.write(addr, ucByte & 0xff);
                    break;
            }
        }

        private M6809ReadWord = (addr: number): number=> {
            var hi = this.M6809ReadByte(addr);
            var lo = this.M6809ReadByte(addr + 1);
            return hi << 8 | lo;
        }

        private M6809WriteWord = (addr: number, usWord: number): void=> {
            this.M6809WriteByte(addr, usWord >> 8);
            this.M6809WriteByte(addr + 1, usWord);
        }

        private pushByte = (ucByte: number, user: boolean): void=> {
            var addr = user ? --this.regU : --this.regS;
            this.M6809WriteByte(addr, ucByte);
        }

        private M6809PUSHBU = (ucByte: number): void=> {
            this.pushByte(ucByte, true);
        }

        private M6809PUSHB = (ucByte: number): void=> {
            this.pushByte(ucByte, false);
        }

        private M6809PUSHW = (usWord: number): void=> {
            // push lo byte first.
            this.M6809PUSHB(usWord);
            this.M6809PUSHB(usWord >> 8);
        }

        private M6809PUSHWU = (usWord: number): void=> {
            // push lo byte first.
            this.M6809PUSHBU(usWord);
            this.M6809PUSHBU(usWord >> 8);
        }

        private pullByte = (user: boolean): number=> {
            var addr = user ? this.regU : this.regS;
            var val = this.M6809ReadByte(addr);
            if (user)++this.regU;
            else ++this.regS;
            return val;
        }

        private M6809PULLB = (): number=> {
            return this.pullByte(false);
        }

        private M6809PULLBU = (): number=> {
            return this.pullByte(true);
        }

        private M6809PULLW = (): number=> {
            var hi = this.M6809PULLB();
            var lo = this.M6809PULLB();
            return hi << 8 | lo;
        }

        private M6809PULLWU = (): number=> {
            var hi = this.M6809PULLBU();
            var lo = this.M6809PULLBU();
            return hi << 8 | lo;
        }

        private M6809PostByte = (): number=> {
            var pReg, usAddr, sTemp;
            var ucPostByte = this.nextPCByte();
            switch (ucPostByte & 0x60) {
                case 0:
                    pReg = 'X';
                    break;
                case 0x20:
                    pReg = 'Y';
                    break;
                case 0x40:
                    pReg = 'U';
                    break;
                case 0x60:
                    pReg = 'S';
                    break;
            }
            pReg = 'reg' + pReg;

            if ((ucPostByte & 0x80) == 0) {
                /* Just a 5 bit signed offset + register */
                var sByte = ucPostByte & 0x1f;
                if (sByte > 15) /* Two's complement 5-bit value */
                    sByte -= 32;
                this.iClocks -= 1;
                return this[pReg] + sByte;
            }

            switch (ucPostByte & 0xf) {
                case 0: /* EA = ,reg+ */
                    usAddr = this[pReg];
                    this[pReg] += 1;
                    this.iClocks -= 2;
                    break;
                case 1: /* EA = ,reg++ */
                    usAddr = this[pReg];
                    this[pReg] += 2;
                    this.iClocks -= 3;
                    break;
                case 2: /* EA = ,-reg */
                    this[pReg] -= 1;
                    usAddr = this[pReg];
                    this.iClocks -= 2;
                    break;
                case 3: /* EA = ,--reg */
                    this[pReg] -= 2;
                    usAddr = this[pReg];
                    this.iClocks -= 3;
                    break;
                case 4: /* EA = ,reg */
                    usAddr = this[pReg];
                    break;
                case 5: /* EA = ,reg + B */
                    usAddr = this[pReg] + makeSignedByte(this.regB);
                    this.iClocks -= 1;
                    break;
                case 6: /* EA = ,reg + A */
                    usAddr = this[pReg] + makeSignedByte(this.regA);
                    this.iClocks -= 1;
                    break;
                case 7: /* illegal */
                    console.log('illegal postbyte pattern 7 at ' + (this.regPC - 1).toString(16));
                    this.halt();
                    usAddr = 0;
                    break;
                case 8: /* EA = ,reg + 8-bit offset */
                    usAddr = this[pReg] + makeSignedByte(this.nextPCByte());
                    this.iClocks -= 1;
                    break;
                case 9: /* EA = ,reg + 16-bit offset */
                    usAddr = this[pReg] + makeSignedWord(this.nextPCWord());
                    this.iClocks -= 4;
                    break;
                case 0xA: /* illegal */
                    console.log('illegal postbyte pattern 0xA' + (this.regPC - 1).toString(16));
                    this.halt();
                    usAddr = 0;
                    break;
                case 0xB: /* EA = ,reg + D */
                    this.iClocks -= 4;
                    usAddr = this[pReg] + this.getRegD();
                    break;
                case 0xC: /* EA = PC + 8-bit offset */
                    sTemp = makeSignedByte(this.nextPCByte());
                    usAddr = this.regPC + sTemp;
                    this.iClocks -= 1;
                    break;
                case 0xD: /* EA = PC + 16-bit offset */
                    sTemp = makeSignedWord(this.nextPCWord());
                    usAddr = this.regPC + sTemp;
                    this.iClocks -= 5;
                    break;
                case 0xE: /* Illegal */
                    console.log('illegal postbyte pattern 0xE' + (this.regPC - 1).toString(16));
                    this.halt();
                    usAddr = 0;
                    break;
                case 0xF: /* EA = [,address] */
                    this.iClocks -= 5;
                    usAddr = this.nextPCWord();
                    break;
            } /* switch */

            if (ucPostByte & 0x10) /* Indirect addressing */ {
                usAddr = this.M6809ReadWord(usAddr & 0xffff);
                this.iClocks -= 3;
            }
            return usAddr & 0xffff; /* Return the effective address */
        }

        private M6809PSHS = (ucTemp: number): void=> {
            var i = 0;

            if (ucTemp & 0x80) {
                this.M6809PUSHW(this.regPC);
                i += 2;
            }
            if (ucTemp & 0x40) {
                this.M6809PUSHW(this.regU);
                i += 2;
            }
            if (ucTemp & 0x20) {
                this.M6809PUSHW(this.regY);
                i += 2;
            }
            if (ucTemp & 0x10) {
                this.M6809PUSHW(this.regX);
                i += 2;
            }
            if (ucTemp & 0x8) {
                this.M6809PUSHB(this.regDP);
                i++;
            }
            if (ucTemp & 0x4) {
                this.M6809PUSHB(this.regB);
                i++;
            }
            if (ucTemp & 0x2) {
                this.M6809PUSHB(this.regA);
                i++;
            }
            if (ucTemp & 0x1) {
                this.M6809PUSHB(this.regCC);
                i++;
            }
            this.iClocks -= i; /* Add extra clock cycles (1 per byte) */
        }


        private M6809PSHU = (ucTemp: number): void=> {
            var i = 0;

            if (ucTemp & 0x80) {
                this.M6809PUSHWU(this.regPC);
                i += 2;
            }
            if (ucTemp & 0x40) {
                this.M6809PUSHWU(this.regU);
                i += 2;
            }
            if (ucTemp & 0x20) {
                this.M6809PUSHWU(this.regY);
                i += 2;
            }
            if (ucTemp & 0x10) {
                this.M6809PUSHWU(this.regX);
                i += 2;
            }
            if (ucTemp & 0x8) {
                this.M6809PUSHBU(this.regDP);
                i++;
            }
            if (ucTemp & 0x4) {
                this.M6809PUSHBU(this.regB);
                i++;
            }
            if (ucTemp & 0x2) {
                this.M6809PUSHBU(this.regA);
                i++;
            }
            if (ucTemp & 0x1) {
                this.M6809PUSHBU(this.regCC);
                i++;
            }
            this.iClocks -= i; /* Add extra clock cycles (1 per byte) */
        }


        private M6809PULS = (ucTemp: number): void=> {
            var i = 0;
            if (ucTemp & 0x1) {
                this.regCC = this.M6809PULLB();
                i++;
            }
            if (ucTemp & 0x2) {
                this.regA = this.M6809PULLB();
                i++;
            }
            if (ucTemp & 0x4) {
                this.regB = this.M6809PULLB();
                i++;
            }
            if (ucTemp & 0x8) {
                this.regDP = this.M6809PULLB();
                i++;
            }
            if (ucTemp & 0x10) {
                this.regX = this.M6809PULLW();
                i += 2;
            }
            if (ucTemp & 0x20) {
                this.regY = this.M6809PULLW();
                i += 2;
            }
            if (ucTemp & 0x40) {
                this.regU = this.M6809PULLW();
                i += 2;
            }
            if (ucTemp & 0x80) {
                this.regPC = this.M6809PULLW();
                i += 2;
            }
            this.iClocks -= i; /* Add extra clock cycles (1 per byte) */
        }

        private M6809PULU = (ucTemp: number): void=> {
            var i = 0;
            if (ucTemp & 0x1) {
                this.regCC = this.M6809PULLBU();
                i++;
            }
            if (ucTemp & 0x2) {
                this.regA = this.M6809PULLBU();
                i++;
            }
            if (ucTemp & 0x4) {
                this.regB = this.M6809PULLBU();
                i++;
            }
            if (ucTemp & 0x8) {
                this.regDP = this.M6809PULLBU();
                i++;
            }
            if (ucTemp & 0x10) {
                this.regX = this.M6809PULLWU();
                i += 2;
            }
            if (ucTemp & 0x20) {
                this.regY = this.M6809PULLWU();
                i += 2;
            }
            if (ucTemp & 0x40) {
                this.regU = this.M6809PULLWU();
                i += 2;
            }
            if (ucTemp & 0x80) {
                this.regPC = this.M6809PULLWU();
                i += 2;
            }
            this.iClocks -= i; /* Add extra clock cycles (1 per byte) */
        }

        public handleIRQ = (interruptRequest: number): number => {
            /* NMI is highest priority */
            if (interruptRequest & INT_NMI) {
                console.log("taking NMI!!!!");
                this.M6809PUSHW(this.regPC);
                this.M6809PUSHW(this.regU);
                this.M6809PUSHW(this.regY);
                this.M6809PUSHW(this.regX);
                this.M6809PUSHB(this.regDP);
                this.M6809PUSHB(this.regB);
                this.M6809PUSHB(this.regA);
                this.regCC |= 0x80; /* Set bit indicating machine state on stack */
                this.M6809PUSHB(this.regCC);
                this.regCC |= F.FIRQMASK | F.IRQMASK; /* Mask interrupts during service routine */
                this.iClocks -= 19;
                this.regPC = this.M6809ReadWord(0xfffc);
                interruptRequest &= ~INT_NMI; /* clear this bit */
                console.log(this.state());
                return interruptRequest;
            }
            /* Fast IRQ is next priority */
            if (interruptRequest & INT_FIRQ && (this.regCC & F.FIRQMASK) == 0) {
                console.log("taking FIRQ!!!!");
                this.M6809PUSHW(this.regPC);
                this.regCC &= 0x7f; /* Clear bit indicating machine state on stack */
                this.M6809PUSHB(this.regCC);
                interruptRequest &= ~INT_FIRQ; /* clear this bit */
                this.regCC |= F.FIRQMASK | F.IRQMASK; /* Mask interrupts during service routine */
                this.iClocks -= 10;
                this.regPC = this.M6809ReadWord(0xfff6);
                console.log(this.state());
                return interruptRequest;
            }
            /* IRQ is lowest priority */
            if (interruptRequest & INT_IRQ && (this.regCC & F.IRQMASK) == 0) {
                console.log("taking IRQ!!!!");
                this.M6809PUSHW(this.regPC);
                this.M6809PUSHW(this.regU);
                this.M6809PUSHW(this.regY);
                this.M6809PUSHW(this.regX);
                this.M6809PUSHB(this.regDP);
                this.M6809PUSHB(this.regB);
                this.M6809PUSHB(this.regA);
                this.regCC |= 0x80; /* Set bit indicating machine state on stack */
                this.M6809PUSHB(this.regCC);
                this.regCC |= F.IRQMASK; /* Mask interrupts during service routine */
                this.regPC = this.M6809ReadWord(0xfff8);
                interruptRequest &= ~INT_IRQ; /* clear this bit */
                this.iClocks -= 19;
                console.log(this.state());
                return interruptRequest;
            }
            return interruptRequest;
        }
        
        public toggleDebug = (): void=> {
            this.debug = !this.debug;
            console.log("debug " + this.debug);
        }

        private _flagnz = (val: number): void=> {
            if ((val & 0xff) == 0)
                this.regCC |= F.ZERO;
            else if (val & 0x80)
                this.regCC |= F.NEGATIVE;
        }

        private _flagnz16 = (val: number): void=> {
            if ((val & 0xffff) == 0)
                this.regCC |= F.ZERO;
            else if (val & 0x8000)
                this.regCC |= F.NEGATIVE;
        }

        private _neg = (val: number): number=> {
            this.regCC &= ~(F.CARRY | F.ZERO | F.OVERFLOW | F.NEGATIVE);
            if (val == 0x80)
                this.regCC |= F.OVERFLOW;
            val = ~val + 1;
            val &= 0xff;
            this._flagnz(val);
            if (this.regCC & F.NEGATIVE)
                this.regCC |= F.CARRY;
            return val;
        }

        private _com = (val: number): number=> {
            this.regCC &= ~(F.ZERO | F.OVERFLOW | F.NEGATIVE);
            this.regCC |= F.CARRY;
            val = ~val;
            val &= 0xff;
            this._flagnz(val);
            return val;
        }

        private _lsr = (val: number): number=> {
            this.regCC &= ~(F.ZERO | F.CARRY | F.NEGATIVE);
            if (val & 1)
                this.regCC |= F.CARRY;
            val >>= 1;
            val &= 0xff;
            if (val == 0)
                this.regCC |= F.ZERO;
            return val;
        }

        private _ror = (val: number): number=> {
            var oldc = this.regCC & F.CARRY;
            this.regCC &= ~(F.ZERO | F.CARRY | F.NEGATIVE);
            if (val & 1)
                this.regCC |= F.CARRY;
            val = val >> 1 | oldc << 7;
            val &= 0xff;
            this._flagnz(val);
            return val;
        }

        private _asr = (val: number): number=> {
            this.regCC &= ~(F.ZERO | F.CARRY | F.NEGATIVE);
            if (val & 1)
                this.regCC |= F.CARRY;
            val = val & 0x80 | val >> 1;
            val &= 0xff;
            this._flagnz(val);
            return val;
        }

        private _asl = (val: number): number=> {
            var oldval = val;
            this.regCC &= ~(F.ZERO | F.CARRY | F.OVERFLOW | F.NEGATIVE);
            if (val & 0x80)
                this.regCC |= F.CARRY;
            val <<= 1;
            val &= 0xff;
            this._flagnz(val);
            if ((oldval ^ val) & 0x80)
                this.regCC |= F.OVERFLOW;
            return val;
        }

        private _rol = (val: number): number=> {
            var oldval = val;
            var oldc = this.regCC & F.CARRY; /* Preserve old carry flag */
            this.regCC &= ~(F.ZERO | F.CARRY | F.OVERFLOW | F.NEGATIVE);
            if (val & 080)
                this.regCC |= F.CARRY;
            val = val << 1 | oldc;
            val &= 0xff;
            this._flagnz(val);
            if ((oldval ^ val) & 0x80)
                this.regCC |= F.OVERFLOW;
            return val;
        }

        private _dec = (val: number): number=> {
            val--;
            val &= 0xff;
            this.regCC &= ~(F.ZERO | F.OVERFLOW | F.NEGATIVE);
            this._flagnz(val);
            if (val == 0x7f || val == 0xff)
                this.regCC |= F.OVERFLOW;
            return val;
        }

        private _inc = (val: number): number=> {
            val++;
            val &= 0xff;
            this.regCC &= ~(F.ZERO | F.OVERFLOW | F.NEGATIVE);
            this._flagnz(val);
            if (val == 0x80 || val == 0)
                this.regCC |= F.OVERFLOW;
            return val;
        }

        private _tst = (val: number): number=> {
            this.regCC &= ~(F.ZERO | F.OVERFLOW | F.NEGATIVE);
            this._flagnz(val);
            return val;
        }

        private _clr = (addr: number): void=> {
            this.M6809WriteByte(addr, 0);
            /* clear N,V,C, set Z */
            this.regCC &= ~(F.CARRY | F.OVERFLOW | F.NEGATIVE);
            this.regCC |= F.ZERO;
        }

        private _or = (ucByte1: number, ucByte2: number): number=> {
            this.regCC &= ~(F.ZERO | F.OVERFLOW | F.NEGATIVE);
            var ucTemp = ucByte1 | ucByte2;
            this._flagnz(ucTemp);
            return ucTemp;
        }

        private _eor = (ucByte1: number, ucByte2: number): number=> {
            this.regCC &= ~(F.ZERO | F.OVERFLOW | F.NEGATIVE);
            var ucTemp = ucByte1 ^ ucByte2;
            this._flagnz(ucTemp);
            return ucTemp;
        }

        private _and = (ucByte1: number, ucByte2: number): number=> {
            this.regCC &= ~(F.ZERO | F.OVERFLOW | F.NEGATIVE);
            var ucTemp = ucByte1 & ucByte2;
            this._flagnz(ucTemp);
            return ucTemp;
        }

        private _cmp = (ucByte1: number, ucByte2: number): void=> {
            var sTemp = (ucByte1 & 0xff) - (ucByte2 & 0xff);
            this.regCC &= ~(F.ZERO | F.CARRY | F.OVERFLOW | F.NEGATIVE);
            this._flagnz(sTemp);
            if (sTemp & 0x100)
                this.regCC |= F.CARRY;
            this.regCC |= SET_V8(ucByte1, ucByte2, sTemp);
        }

        private _setcc16 = (usWord1: number, usWord2: number, lTemp: number): void => {
            this.regCC &= ~(F.ZERO | F.CARRY | F.OVERFLOW | F.NEGATIVE);
            this._flagnz16(lTemp);
            if (lTemp & 0x10000)
                this.regCC |= F.CARRY;
            this.regCC |= SET_V16(usWord1 & 0xffff, usWord2 & 0xffff, lTemp & 0x1ffff);
        }

        private _cmp16 = (usWord1: number, usWord2: number): void=> {
            var lTemp = (usWord1 & 0xffff) - (usWord2 & 0xffff);
            this._setcc16(usWord1, usWord2, lTemp);
        }

        private _sub = (ucByte1: number, ucByte2: number): number=> {
            var sTemp = (ucByte1 & 0xff) - (ucByte2 & 0xff);
            this.regCC &= ~(F.ZERO | F.CARRY | F.OVERFLOW | F.NEGATIVE);
            this._flagnz(sTemp);
            if (sTemp & 0x100)
                this.regCC |= F.CARRY;
            this.regCC |= SET_V8(ucByte1, ucByte2, sTemp);
            return sTemp & 0xff;
        }

        private _sub16 = (usWord1: number, usWord2: number): number=> {
            var lTemp = (usWord1 & 0xffff) - (usWord2 & 0xffff);
            this._setcc16(usWord1, usWord2, lTemp);
            return lTemp & 0xffff;
        }

        private _sbc = (ucByte1: number, ucByte2: number): number=> {
            var sTemp = (ucByte1 & 0xff) - (ucByte2 & 0xff) - (this.regCC & 1);
            this.regCC &= ~(F.ZERO | F.CARRY | F.OVERFLOW | F.NEGATIVE);
            this._flagnz(sTemp);
            if (sTemp & 0x100)
                this.regCC |= F.CARRY;
            this.regCC |= SET_V8(ucByte1, ucByte2, sTemp);
            return sTemp & 0xff;
        }

        private _add = (ucByte1: number, ucByte2: number): number=> {
            var sTemp = (ucByte1 & 0xff) + (ucByte2 & 0xff);
            this.regCC &= ~(F.HALFCARRY | F.ZERO | F.CARRY | F.OVERFLOW | F.NEGATIVE);
            this._flagnz(sTemp);
            if (sTemp & 0x100)
                this.regCC |= F.CARRY;
            this.regCC |= SET_V8(ucByte1, ucByte2, sTemp);
            if ((sTemp ^ ucByte1 ^ ucByte2) & 0x10)
                this.regCC |= F.HALFCARRY;
            return sTemp & 0xff;
        }

        private _add16 = (usWord1: number, usWord2: number): number=> {
            var lTemp = (usWord1 & 0xffff) + (usWord2 & 0xffff);
            this._setcc16(usWord1, usWord2, lTemp);
            return lTemp & 0xffff;
        }

        private _adc = (ucByte1: number, ucByte2: number): number=> {
            var sTemp = (ucByte1 & 0xff) + (ucByte2 & 0xff) + (this.regCC & 1);
            this.regCC &= ~(F.HALFCARRY | F.ZERO | F.CARRY | F.OVERFLOW | F.NEGATIVE);
            this._flagnz(sTemp);
            if (sTemp & 0x100)
                this.regCC |= F.CARRY;
            this.regCC |= SET_V8(ucByte1, ucByte2, sTemp);
            if ((sTemp ^ ucByte1 ^ ucByte2) & 0x10)
                this.regCC |= F.HALFCARRY;
            return sTemp & 0xff;
        }
        private dpAddr = () => {
            return (this.regDP << 8) + this.nextPCByte();
        }

        private dpOp = (func: (val: number) => number): void=> {
            var addr = this.dpAddr();
            var val = this.M6809ReadByte(addr);
            this.M6809WriteByte(addr, func(val));
        }

        /* direct page addressing */
        private neg = () => { this.dpOp(this._neg); }
        private com = () => { this.dpOp(this._com); }
        private lsr = () => { this.dpOp(this._lsr); }
        private ror = () => { this.dpOp(this._ror); }
        private asr = () => { this.dpOp(this._asr); }
        private asl = () => { this.dpOp(this._asl); }
        private rol = () => { this.dpOp(this._rol); }
        private dec = () => { this.dpOp(this._dec); }
        private inc = () => { this.dpOp(this._inc); }
        private tst = () => { this.dpOp(this._tst); }
        private jmp = () => { this.regPC = this.dpAddr(); }
        private clr = () => { this._clr(this.dpAddr()); }

        /* P10  extended Op codes */

        private lbrn = () => { this.regPC += 2; }
        private lbhi = () => {
            var sTemp = makeSignedWord(this.nextPCWord());
            if (!(this.regCC & (F.CARRY | F.ZERO))) {
                this.iClocks -= 1; /* Extra clock if branch taken */
                this.regPC += sTemp;
            }
        }

        private lbls = () => { // 0x23: /* LBLS */
            var sTemp = makeSignedWord(this.nextPCWord());
            if (this.regCC & (F.CARRY | F.ZERO)) {
                this.iClocks -= 1; /* Extra clock if branch taken */
                this.regPC += sTemp;
            }
        }

        private lbcc = () => { // 0x24: /* LBCC */
            var sTemp = makeSignedWord(this.nextPCWord());
            if (!(this.regCC & F.CARRY)) {
                this.iClocks -= 1; /* Extra clock if branch taken */
                this.regPC += sTemp;
            }
        }

        private lbcs = () => { // 0x25: /* LBCS */
            var sTemp = makeSignedWord(this.nextPCWord());
            if (this.regCC & F.CARRY) {
                this.iClocks -= 1; /* Extra clock if branch taken */
                this.regPC += sTemp;
            }
        }

        private lbne = () => { // 0x26: /* LBNE */
            var sTemp = makeSignedWord(this.nextPCWord());
            if (!(this.regCC & F.ZERO)) {
                this.iClocks -= 1; /* Extra clock if branch taken */
                this.regPC += sTemp;
            }
        }

        private lbeq = () => { // 0x27: /* LBEQ */
            var sTemp = makeSignedWord(this.nextPCWord());
            if (this.regCC & F.ZERO) {
                this.iClocks -= 1; /* Extra clock if branch taken */
                this.regPC += sTemp;
            }
        }

        private lbvc = () => { // 0x28: /* LBVC */
            var sTemp = makeSignedWord(this.nextPCWord());
            if (!(this.regCC & F.OVERFLOW)) {
                this.iClocks -= 1; /* Extra clock if branch taken */
                this.regPC += sTemp;
            }
        }

        private lbvs = () => { // 0x29: /* LBVS */
            var sTemp = makeSignedWord(this.nextPCWord());
            if (this.regCC & F.OVERFLOW) {
                this.iClocks -= 1; /* Extra clock if branch taken */
                this.regPC += sTemp;
            }
        }

        private lbpl = () => { // 0x2A: /* LBPL */
            var sTemp = makeSignedWord(this.nextPCWord());
            if (!(this.regCC & F.NEGATIVE)) {
                this.iClocks -= 1; /* Extra clock if branch taken */
                this.regPC += sTemp;
            }
        }

        private lbmi = () => { // 0x2B: /* LBMI */
            var sTemp = makeSignedWord(this.nextPCWord());
            if (this.regCC & F.NEGATIVE) {
                this.iClocks -= 1; /* Extra clock if branch taken */
                this.regPC += sTemp;
            }
        }

        private lbge = () => { // 0x2C: /* LBGE */
            var sTemp = makeSignedWord(this.nextPCWord());
            if (!((this.regCC & F.NEGATIVE) ^ (this.regCC & F.OVERFLOW) << 2)) {
                this.iClocks -= 1; /* Extra clock if branch taken */
                this.regPC += sTemp;
            }
        }

        private lblt = () => { // 0x2D: /* LBLT */
            var sTemp = makeSignedWord(this.nextPCWord());
            if ((this.regCC & F.NEGATIVE) ^ (this.regCC & F.OVERFLOW) << 2) {
                this.iClocks -= 1; /* Extra clock if branch taken */
                this.regPC += sTemp;
            }
        }

        private lbgt = () => { // 0x2E: /* LBGT */
            var sTemp = makeSignedWord(this.nextPCWord());
            if (!((this.regCC & F.NEGATIVE) ^ (this.regCC & F.OVERFLOW) << 2 || this.regCC & F.ZERO)) {
                this.iClocks -= 1; /* Extra clock if branch taken */
                this.regPC += sTemp;
            }
        }

        private lble = () => { // 0x2F: /* LBLE */
            var sTemp = makeSignedWord(this.nextPCWord());
            if ((this.regCC & F.NEGATIVE) ^ (this.regCC & F.OVERFLOW) << 2 || this.regCC & F.ZERO) {
                this.iClocks -= 1; /* Extra clock if branch taken */
                this.regPC += sTemp;
            }
        }

        private swi2 = () => { // 0x3F: /* SWI2 */
            this.regCC |= 0x80; /* Entire machine state stacked */
            this.M6809PUSHW(this.regPC);
            this.M6809PUSHW(this.regU);
            this.M6809PUSHW(this.regY);
            this.M6809PUSHW(this.regX);
            this.M6809PUSHB(this.regDP);
            this.M6809PUSHB(this.regA);
            this.M6809PUSHB(this.regB);
            this.M6809PUSHB(this.regCC);
            this.regPC = this.M6809ReadWord(0xfff4);
        }

        private cmpd = () => { // 0x83: /* CMPD - immediate*/
            var usTemp = this.nextPCWord();
            this._cmp16(this.getRegD(), usTemp);
        }

        private cmpy = () => { // 0x8C: /* CMPY - immediate */
            var usTemp = this.nextPCWord();
            this._cmp16(this.regY, usTemp);
        }

        private ldy = () => { // 0x8E: /* LDY - immediate */
            this.regY = this.nextPCWord();
            this._flagnz16(this.regY);
            this.regCC &= ~F.OVERFLOW;
        }

        private cmpdd = () => { // 0x93: /* CMPD - direct */
            var usAddr = this.regDP * 256 + this.nextPCByte();
            var usTemp = this.M6809ReadWord(usAddr);
            this._cmp16(this.getRegD(), usTemp);
        }

        private cmpyd = () => { // 0x9c: /* CMPY - direct */
            var usAddr = this.regDP * 256 + this.nextPCByte();
            var usTemp = this.M6809ReadWord(usAddr);
            this._cmp16(this.regY, usTemp);
        }

        private ldyd = () => { // 0x9E: /* LDY - direct */
            var usAddr = this.regDP * 256 + this.nextPCByte();
            this.regY = this.M6809ReadWord(usAddr);
            this._flagnz16(this.regY);
            this.regCC &= ~F.OVERFLOW;
        }

        private sty = () => { // 0x9F: /* STY - direct */
            var usAddr = this.regDP * 256 + this.nextPCByte();
            this.M6809WriteWord(usAddr, this.regY);
            this._flagnz16(this.regY);
            this.regCC &= ~F.OVERFLOW;
        }

        private cmpdi = () => { // 0xA3: /* CMPD - indexed */
            var usAddr = this.M6809PostByte();
            var usTemp = this.M6809ReadWord(usAddr);
            this._cmp16(this.getRegD(), usTemp);
        }
        private cmpyi = () => { // 0xAC: /* CMPY - indexed */
            var usAddr = this.M6809PostByte();
            var usTemp = this.M6809ReadWord(usAddr);
            this._cmp16(this.regY, usTemp);
        }
        private ldyi = () => { // 0xAE: /* LDY - indexed */
            var usAddr = this.M6809PostByte();
            this.regY = this.M6809ReadWord(usAddr);
            this._flagnz16(this.regY);
            this.regCC &= ~F.OVERFLOW;
        }
        private styi = () => { // 0xAF: /* STY - indexed */
            var usAddr = this.M6809PostByte();
            this.M6809WriteWord(usAddr, this.regY);
            this._flagnz16(this.regY);
            this.regCC &= ~F.OVERFLOW;
        }
        private cmpde = () => { // 0xB3: /* CMPD - extended */
            var usAddr = this.nextPCWord();
            var usTemp = this.M6809ReadWord(usAddr);
            this._cmp16(this.getRegD(), usTemp);
        }
        private cmpye = () => { // 0xBC: /* CMPY - extended */
            var usAddr = this.nextPCWord();
            var usTemp = this.M6809ReadWord(usAddr);
            this._cmp16(this.regY, usTemp);
        }
        private ldye = () => { // 0xBE: /* LDY - extended */
            var usAddr = this.nextPCWord();
            this.regY = this.M6809ReadWord(usAddr);
            this._flagnz16(this.regY);
            this.regCC &= ~F.OVERFLOW;
        }
        private stye = () => { // 0xBF: /* STY - extended */
            var usAddr = this.nextPCWord();
            this.M6809WriteWord(usAddr, this.regY);
            this._flagnz16(this.regY);
            this.regCC &= ~F.OVERFLOW;
        }
        private lds = () => { // 0xCE: /* LDS - immediate */
            this.regS = this.nextPCWord();
            this._flagnz16(this.regS);
            this.regCC &= ~F.OVERFLOW;
        }
        private ldsd = () => { // 0xDE: /* LDS - direct */
            var usAddr = this.regDP * 256 + this.nextPCByte();
            this.regS = this.M6809ReadWord(usAddr);
            this._flagnz16(this.regS);
            this.regCC &= ~F.OVERFLOW;
        }
        private stsd = () => { // 0xDF: /* STS - direct */
            var usAddr = this.regDP * 256 + this.nextPCByte();
            this.M6809WriteWord(usAddr, this.regS);
            this._flagnz16(this.regS);
            this.regCC &= ~F.OVERFLOW;
        }
        private ldsi = () => { // 0xEE: /* LDS - indexed */
            var usAddr = this.M6809PostByte();
            this.regS = this.M6809ReadWord(usAddr);
            this._flagnz16(this.regS);
            this.regCC &= ~F.OVERFLOW;
        }
        private stsi = () => { // 0xEF: /* STS - indexed */
            var usAddr = this.M6809PostByte();
            this.M6809WriteWord(usAddr, this.regS);
            this._flagnz16(this.regS);
            this.regCC &= ~F.OVERFLOW;
        }
        private ldse = () => { // 0xFE: /* LDS - extended */
            var usAddr = this.nextPCWord();
            this.regS = this.M6809ReadWord(usAddr);
            this._flagnz16(this.regS);
            this.regCC &= ~F.OVERFLOW;
        }
        private stse = () => { // 0xFF: /* STS - extended */
            var usAddr = this.nextPCWord();
            this.M6809WriteWord(usAddr, this.regS);
            this._flagnz16(this.regS);
            this.regCC &= ~F.OVERFLOW;
        }

        private p10 = () => {
            var op = this.nextPCByte(); /* Second half of opcode */
            this.iClocks -= c6809Cycles2[op]; /* Subtract execution time */
            if (this.debug)
                console.log((this.regPC - 1).toString(16) + ': ' + this.mnemonics10[op]);
            var instruction = this.instructions10[op];
            if (instruction == null) {
                console.log('*** illegal p10 opcode: ' + op.toString(16) + ' at ' + (this.regPC - 1).toString(16));
                this.halt();
            } else {
                instruction();
            }
        }

        private instructions10: { (): void; }[] = [
            null, null, null, null, null, null, null, null, // 00..07
            null, null, null, null, null, null, null, null, // 08..0f
            null, null, null, null, null, null, null, null, // 10..17
            null, null, null, null, null, null, null, null, // 18..1f
            null, this.lbrn, this.lbhi, this.lbls, this.lbcc, this.lbcs, this.lbne, this.lbeq, // 20..27
            this.lbvc, this.lbvs, this.lbpl, this.lbmi, this.lbge, this.lblt, this.lbgt, this.lble, // 28..2f
            null, null, null, null, null, null, null, null, // 30..37
            null, null, null, null, null, null, null, this.swi2, // 38..3f
            null, null, null, null, null, null, null, null, // 40..47
            null, null, null, null, null, null, null, null, // 48..4f
            null, null, null, null, null, null, null, null, // 50..57
            null, null, null, null, null, null, null, null, // 58..5f
            null, null, null, null, null, null, null, null, // 60..67
            null, null, null, null, null, null, null, null, // 68..6f
            null, null, null, null, null, null, null, null, // 70..77
            null, null, null, null, null, null, null, null, // 78..7f
            null, null, null, this.cmpd, null, null, null, null, // 80..87
            null, null, null, null, this.cmpy, null, this.ldy, null, // 88..8f
            null, null, null, this.cmpdd, null, null, null, null, // 90..97
            null, null, null, null, this.cmpyd, null, this.ldyd, this.sty, // 98..9f
            null, null, null, this.cmpdi, null, null, null, null, // a0..a7
            null, null, null, null, this.cmpyi, null, this.ldyi, this.styi, // a8..af
            null, null, null, this.cmpde, null, null, null, null, // b0..b7
            null, null, null, null, this.cmpye, null, this.ldye, this.stye, // b8..bf
            null, null, null, null, null, null, null, null, // c0..c7
            null, null, null, null, null, null, this.lds, null, // c8..cf
            null, null, null, null, null, null, null, null, // d0..d7
            null, null, null, null, null, null, this.ldsd, this.stsd, // d8..df
            null, null, null, null, null, null, null, null, // e0..e7
            null, null, null, null, null, null, this.ldsi, this.stsi, // e8..ef
            null, null, null, null, null, null, null, null, // f0..f7
            null, null, null, null, null, null, this.ldse, this.stse // f8..ff
        ];

        private mnemonics10: string[] = [
            '     ', '     ', '     ', '     ', '     ', '     ', '     ', '     ', // 00..07
            '     ', '     ', '     ', '     ', '     ', '     ', '     ', '     ', // 08..0f
            '     ', '     ', '     ', '     ', '     ', '     ', '     ', '     ', // 10..17
            '     ', '     ', '     ', '     ', '     ', '     ', '     ', '     ', // 18..1f
            '     ', 'lbrn ', 'lbhi ', 'lbls ', 'lbcc ', 'lbcs ', 'lbne ', 'lbeq ', // 20..27
            'lbvc ', 'lbvs ', 'lbpl ', 'lbmi ', 'lbge ', 'lblt ', 'lbgt ', 'lble ', // 28..2f
            '     ', '     ', '     ', '     ', '     ', '     ', '     ', '     ', // 30..37
            '     ', '     ', '     ', '     ', '     ', '     ', '     ', 'swi2 ', // 38..3f
            '     ', '     ', '     ', '     ', '     ', '     ', '     ', '     ', // 40..47
            '     ', '     ', '     ', '     ', '     ', '     ', '     ', '     ', // 48..4f
            '     ', '     ', '     ', '     ', '     ', '     ', '     ', '     ', // 50..57
            '     ', '     ', '     ', '     ', '     ', '     ', '     ', '     ', // 58..5f
            '     ', '     ', '     ', '     ', '     ', '     ', '     ', '     ', // 60..67
            '     ', '     ', '     ', '     ', '     ', '     ', '     ', '     ', // 68..6f
            '     ', '     ', '     ', '     ', '     ', '     ', '     ', '     ', // 70..77
            '     ', '     ', '     ', '     ', '     ', '     ', '     ', '     ', // 78..7f
            '     ', '     ', '     ', 'cmpd ', '     ', '     ', '     ', '     ', // 80..87
            '     ', '     ', '     ', '     ', 'cmpy ', '     ', 'ldy  ', '     ', // 88..8f
            '     ', '     ', '     ', 'cmpdd', '     ', '     ', '     ', '     ', // 90..97
            '     ', '     ', '     ', '     ', 'cmpyd', '     ', 'ldyd ', 'sty  ', // 98..9f
            '     ', '     ', '     ', 'cmpdi', '     ', '     ', '     ', '     ', // a0..a7
            '     ', '     ', '     ', '     ', 'cmpyi', '     ', 'ldyi ', 'styi ', // a8..af
            '     ', '     ', '     ', 'cmpde', '     ', '     ', '     ', '     ', // b0..b7
            '     ', '     ', '     ', '     ', 'cmpye', '     ', 'ldye ', 'stye ', // b8..bf
            '     ', '     ', '     ', '     ', '     ', '     ', '     ', '     ', // c0..c7
            '     ', '     ', '     ', '     ', '     ', '     ', 'lds  ', '     ', // c8..cf
            '     ', '     ', '     ', '     ', '     ', '     ', '     ', '     ', // d0..d7
            '     ', '     ', '     ', '     ', '     ', '     ', 'ldsd ', 'stsd ', // d8..df
            '     ', '     ', '     ', '     ', '     ', '     ', '     ', '     ', // e0..e7
            '     ', '     ', '     ', '     ', '     ', '     ', 'ldsi ', 'stsi ', // e8..ef
            '     ', '     ', '     ', '     ', '     ', '     ', '     ', '     ', // f0..f7
            '     ', '     ', '     ', '     ', '     ', '     ', 'ldse ', 'stse ' // f8..ff
        ];

        /* P10 end */


          /* P11 start */

        private swi3 = () => { // 0x3F: /* SWI3 */
            this.regCC |= 0x80; /* Set entire flag to indicate whole machine state on stack */
            this.M6809PUSHW(this.regPC);
            this.M6809PUSHW(this.regU);
            this.M6809PUSHW(this.regY);
            this.M6809PUSHW(this.regX);
            this.M6809PUSHB(this.regDP);
            this.M6809PUSHB(this.regA);
            this.M6809PUSHB(this.regB);
            this.M6809PUSHB(this.regCC);
            this.regPC = this.M6809ReadWord(0xfff2);
        }

        private cmpu = () => { // 0x83: /* CMPU - immediate */
            var usTemp = this.nextPCWord();
            this._cmp16(this.regU, usTemp);
        }

        private cmps = () => { // 0x8C: /* CMPS - immediate */
            var usTemp = this.nextPCWord();
            this._cmp16(this.regS, usTemp);
        }

        private cmpud = () => { // 0x93: /* CMPU - direct */
            var usAddr = this.regDP * 256 + this.nextPCByte();
            var usTemp = this.M6809ReadWord(usAddr);
            this._cmp16(this.regU, usTemp);
        }

        private cmpsd = () => { // 0x9C: /* CMPS - direct */
            var usAddr = this.regDP * 256 + this.nextPCByte();
            var usTemp = this.M6809ReadWord(usAddr);
            this._cmp16(this.regS, usTemp);
        }

        private cmpui = () => { // 0xA3: /* CMPU - indexed */
            var usAddr = this.M6809PostByte();
            var usTemp = this.M6809ReadWord(usAddr);
            this._cmp16(this.regU, usTemp);
        }

        private cmpsi = () => { // 0xAC: /* CMPS - indexed */
            var usAddr = this.M6809PostByte();
            var usTemp = this.M6809ReadWord(usAddr);
            this._cmp16(this.regS, usTemp);
        }

        private cmpue = () => { // 0xB3: /* CMPU - extended */
            var usAddr = this.nextPCWord();
            var usTemp = this.M6809ReadWord(usAddr);
            this._cmp16(this.regU, usTemp);
        }

        private cmpse = () => { // 0xBC: /* CMPS - extended */
            var usAddr = this.nextPCWord();
            var usTemp = this.M6809ReadWord(usAddr);
            this._cmp16(this.regS, usTemp);
        }

        private instructions11: { (): void; }[] = [];
        private mnemonics11: string[] = [];
        private add11 = (op: number, name: string) => {
            this.instructions11[op] = this[name];
            this.mnemonics11[op] = name;
        }

        private init11 = () => {
            for (var i = 0; i < 256; i++) {
                this.instructions11[i] = null;
                this.mnemonics11[i] = '     ';
            }
            var x = [
                { op: 0x3f, name: 'swi3' },
                { op: 0x83, name: 'cmpu' },
                { op: 0x8c, name: 'cmps' },
                { op: 0x93, name: 'cmpud' },
                { op: 0x9c, name: 'cmpsd' },
                { op: 0xa3, name: 'cmpui' },
                { op: 0xac, name: 'cmpsi' },
                { op: 0xb3, name: 'cmpue' },
                { op: 0xbc, name: 'cmpse' },
            ];
            $.each(x, (i, o) => {
                this.instructions11[o.op] = this[o.name];
                this.mnemonics11[o.op] = o.name;
            });
        }

        private p11 = () => {
            var op = this.nextPCByte(); /* Second half of opcode */
            this.iClocks -= c6809Cycles2[op]; /* Subtract execution time */
            if (this.debug)
                console.log((this.regPC - 1).toString(16) + ': ' + this.mnemonics11[op]);
            var instruction = this.instructions11[op];
            if (instruction == null) {
                console.log('*** illegal p11 opcode: ' + op.toString(16));
                this.halt();
            } else {
                instruction();
            }
        }

        /* p11 end */

        private nop = () => { }
        private sync = () => { }

        private lbra = () => {
            /* LBRA - relative jump */
            var sTemp = makeSignedWord(this.nextPCWord());
            this.regPC += sTemp;
        }

        private lbsr = () => {
            /* LBSR - relative call */
            var sTemp = makeSignedWord(this.nextPCWord());
            this.M6809PUSHW(this.regPC);
            this.regPC += sTemp;
        }

        private daa = (): void=> {
            var cf = 0;
            var msn = this.regA & 0xf0;
            var lsn = this.regA & 0x0f;
            if (lsn > 0x09 || this.regCC & 0x20) cf |= 0x06;
            if (msn > 0x80 && lsn > 0x09) cf |= 0x60;
            if (msn > 0x90 || this.regCC & 0x01) cf |= 0x60;
            var usTemp = cf + this.regA;
            this.regCC &= ~(F.CARRY | F.NEGATIVE | F.ZERO | F.OVERFLOW);
            if (usTemp & 0x100)
                this.regCC |= F.CARRY;
            this.regA = usTemp & 0xff;
            this._flagnz(this.regA);
        }

        private orcc = (): void=> {
            this.regCC |= this.nextPCByte();
        }

        private andcc = (): void=> {
            this.regCC &= this.nextPCByte();
        }

        private sex = (): void=> {
            this.regA = (this.regB & 0x80) ? 0xFF : 0x00;
            this.regCC &= ~(F.ZERO | F.NEGATIVE);
            var d = this.getRegD();
            this._flagnz16(d);
            this.regCC &= ~F.OVERFLOW;
        }
        
        private _setreg = (name: string, value: number) => {
            // console.log(name + '=' + value.toString(16));

            if (name == 'D') {
                this.setRegD(value);
            } else {
                this["reg" + name] = value;
            }
        }

        private M6809TFREXG = (ucPostByte: number, bExchange: boolean): void=> {
            var ucTemp = ucPostByte & 0x88;
            if (ucTemp == 0x80 || ucTemp == 0x08) {
                console.log("**** M6809TFREXG problem...");
                ucTemp = 0; /* PROBLEM! */
            }
            var srname, srcval;
            switch (ucPostByte & 0xf0) /* Get source register */ {
                case 0x00: /* D */
                    srname = 'D';
                    srcval = this.getRegD();
                    break;
                case 0x10: /* X */
                    srname = 'X';
                    srcval = this.regX;
                    break;
                case 0x20: /* Y */
                    srname = 'Y';
                    srcval = this.regY;
                    break;
                case 0x30: /* U */
                    srname = 'U';
                    srcval = this.regU;
                    break;
                case 0x40: /* S */
                    srname = 'S';
                    srcval = this.regS;
                    break;
                case 0x50: /* PC */
                    srname = 'PC';
                    srcval = this.regPC;
                    break;
                case 0x80: /* A */
                    srname = 'A';
                    srcval = this.regA;
                    break;
                case 0x90: /* B */
                    srname = 'B';
                    srcval = this.regB;
                    break;
                case 0xA0: /* CC */
                    srname = 'CC';
                    srcval = this.regCC;
                    break;
                case 0xB0: /* DP */
                    srname = 'DP';
                    srcval = this.regDP;
                    break;
                default: /* Illegal */
                    console.log("illegal src register in M6809TFREXG");
                    this.halt();
                    break;
            }
            // console.log('EXG src: ' + srname + '=' + srcval.toString(16));
            switch (ucPostByte & 0xf) /* Get destination register */ {
                case 0x00: /* D */
                    // console.log('EXG dst: D=' + this.getRegD().toString(16));
                    if (bExchange) {
                        this._setreg(srname, this.getRegD());
                    }
                    this.setRegD(srcval);
                    break;
                case 0x1: /* X */
                    // console.log('EXG dst: X=' + this.regX.toString(16));
                    if (bExchange) {
                        this._setreg(srname, this.regX);
                    }
                    this.regX = srcval;
                    break;
                case 0x2: /* Y */
                    // console.log('EXG dst: Y=' + this.regY.toString(16));
                    if (bExchange) {
                        this._setreg(srname, this.regY);
                    }
                    this.regY = srcval;
                    break;
                case 0x3: /* U */
                    // console.log('EXG dst: U=' + this.regU.toString(16));
                    if (bExchange) {
                        this._setreg(srname, this.regU);
                    }
                    this.regU = srcval;
                    break;
                case 0x4: /* S */
                    // console.log('EXG dst: S=' + this.regS.toString(16));
                    if (bExchange) {
                        this._setreg(srname, this.regS);
                    }
                    this.regS = srcval;
                    break;
                case 0x5: /* PC */
                    // console.log('EXG dst: PC=' + this.regPC.toString(16));
                    if (bExchange) {
                        this._setreg(srname, this.regPC);
                    }
                    this.regPC = srcval;
                    break;
                case 0x8: /* A */
                    // console.log('EXG dst: A=' + this.regA.toString(16));
                    if (bExchange) {
                        this._setreg(srname, this.regA);
                    }
                    this.regA = 0xff & srcval;
                    break;
                case 0x9: /* B */
                    // console.log('EXG dst: B=' + this.regB.toString(16));
                    if (bExchange) {
                        this._setreg(srname, this.regB);
                    }
                    this.regB = 0xff & srcval;
                    break;
                case 0xA: /* CC */
                    // console.log('EXG dst: CC=' + this.regCC.toString(16));
                    if (bExchange) {
                        this._setreg(srname, this.regCC);
                    }
                    this.regCC = 0xff & srcval;
                    break;
                case 0xB: /* DP */
                    // console.log('EXG dst: DP=' + this.regDP.toString(16));
                    if (bExchange) {
                        this._setreg(srname, this.regDP);
                    }
                    this.regDP = srcval;
                    break;
                default: /* Illegal */
                    console.log("illegal dst register in M6809TFREXG");
                    this.halt();
                    break;
            }
        }

        private exg = (): void=> {
            var ucTemp = this.nextPCByte(); /* Get postbyte */
            this.M6809TFREXG(ucTemp, true);
        }

        private tfr = (): void=> {
            var ucTemp = this.nextPCByte(); /* Get postbyte */
            this.M6809TFREXG(ucTemp, false);
        }

        private bra = (): void=> {
            var offset = makeSignedByte(this.nextPCByte());
            this.regPC += offset;
        }
        private brn = (): void=> {
            this.regPC++; // never.
        }
        private bhi = (): void=> {
            var offset = makeSignedByte(this.nextPCByte());
            if (!(this.regCC & (F.CARRY | F.ZERO)))
                this.regPC += offset;
        }
        private bls = (): void=> {
            var offset = makeSignedByte(this.nextPCByte());
            if (this.regCC & (F.CARRY | F.ZERO))
                this.regPC += offset;
        }

        private branchIf = (go: boolean): void=> {
            var offset = makeSignedByte(this.nextPCByte());
            if (go)
                this.regPC += offset;
        }

        private branch = (flag: number, ifSet: boolean): void=> {
            this.branchIf((this.regCC & flag) == (ifSet ? flag : 0));
        }

        private bcc = (): void=> {
            this.branch(F.CARRY, false);
        }

        private bcs = (): void=> {
            this.branch(F.CARRY, true);
        }

        private bne = (): void=> {
            this.branch(F.ZERO, false);
        }

        private beq = (): void=> {
            this.branch(F.ZERO, true);
        }

        private bvc = (): void=> {
            this.branch(F.OVERFLOW, false);
        }

        private bvs = (): void=> {
            this.branch(F.OVERFLOW, true);
        }

        private bpl = (): void=> {
            this.branch(F.NEGATIVE, false);
        }
        private bmi = (): void=> {
            this.branch(F.NEGATIVE, true);
        }

        private bge = (): void=> {
            var go = !((this.regCC & F.NEGATIVE) ^ (this.regCC & F.OVERFLOW) << 2);
            this.branchIf(go);
        }
        private blt = (): void=> {
            var go = (this.regCC & F.NEGATIVE) ^ (this.regCC & F.OVERFLOW) << 2;
            this.branchIf(go != 0);
        }
        private bgt = (): void=> {
            var bit = (this.regCC & F.NEGATIVE) ^ (this.regCC & F.OVERFLOW) << 2;
            var go = bit == 0 || (this.regCC & F.ZERO) != 0;
            this.branchIf(go);
        }
        private ble = (): void=> {
            var bit = (this.regCC & F.NEGATIVE) ^ (this.regCC & F.OVERFLOW) << 2;
            var go = bit != 0 || (this.regCC & F.ZERO) != 0;
            this.branchIf(go);
        }

        private leax = (): void=> {
            this.regX = this.M6809PostByte();
            this.regCC &= ~F.ZERO;
            if (this.regX == 0)
                this.regCC |= F.ZERO;
        }

        private leay = (): void=> {
            this.regY = this.M6809PostByte();
            this.regCC &= ~F.ZERO;
            if (this.regY == 0)
                this.regCC |= F.ZERO;
        }

        private leas = (): void=> {
            this.regS = this.M6809PostByte();
        }

        private leau = (): void=> {
            this.regU = this.M6809PostByte();
        }

        private pshs = (): void=> {
            var ucTemp = this.nextPCByte(); /* Get the flags byte */
            this.M6809PSHS(ucTemp);
        }
        private puls = (): void=> {
            var ucTemp = this.nextPCByte(); /* Get the flags byte */
            this.M6809PULS(ucTemp);
        }
        private pshu = (): void=> {
            var ucTemp = this.nextPCByte(); /* Get the flags byte */
            this.M6809PSHU(ucTemp);
        }
        private pulu = (): void=> {
            var ucTemp = this.nextPCByte(); /* Get the flags byte */
            this.M6809PULU(ucTemp);
        }

        private rts = (): void=> { this.regPC = this.M6809PULLW(); }

        private abx = (): void=> { this.regX += this.regB; }

        private rti = (): void=> {
            this.regCC = this.M6809PULLB();
            if (this.regCC & 0x80) /* Entire machine state stacked? */ {
                this.iClocks -= 9;
                this.regA = this.M6809PULLB();
                this.regB = this.M6809PULLB();
                this.regDP = this.M6809PULLB();
                this.regX = this.M6809PULLW();
                this.regY = this.M6809PULLW();
                this.regU = this.M6809PULLW();
            }
            this.regPC = this.M6809PULLW();
        }

        private cwai = (): void=> {
            this.regCC &= this.nextPCByte();
        }

        private mul = (): void=> {
            var usTemp = this.regA * this.regB;
            if (usTemp)
                this.regCC &= ~F.ZERO;
            else
                this.regCC |= F.ZERO;
            if (usTemp & 0x80)
                this.regCC |= F.CARRY;
            else
                this.regCC &= ~F.CARRY;
            this.setRegD(usTemp);
        }

        private swi = (): void=> {
            this.regCC |= 0x80; /* Indicate whole machine state is stacked */
            this.M6809PUSHW(this.regPC);
            this.M6809PUSHW(this.regU);
            this.M6809PUSHW(this.regY);
            this.M6809PUSHW(this.regX);
            this.M6809PUSHB(this.regDP);
            this.M6809PUSHB(this.regB);
            this.M6809PUSHB(this.regA);
            this.M6809PUSHB(this.regCC);
            this.regCC |= 0x50; /* Disable further interrupts */
            this.regPC = this.M6809ReadWord(0xfffa);
        }

        private nega = (): void=> {
            this.regA = this._neg(this.regA);
        }
        private coma = (): void=> {
            this.regA = this._com(this.regA);
        }
        private lsra = (): void=> {
            this.regA = this._lsr(this.regA);
        }
        private rora = (): void=> {
            this.regA = this._ror(this.regA);
        }
        private asra = (): void=> {
            this.regA = this._asr(this.regA);
        }
        private asla = (): void=> {
            this.regA = this._asl(this.regA);
        }
        private rola = (): void=> {
            this.regA = this._rol(this.regA);
        }
        private deca = (): void=> {
            this.regA = this._dec(this.regA);
        }
        private inca = (): void=> {
            this.regA = this._inc(this.regA);
        }
        private tsta = (): void=> {
            this.regCC &= ~(F.ZERO | F.NEGATIVE | F.OVERFLOW);
            this._flagnz(this.regA);
        }

        private clra = (): void=> {
            this.regA = 0;
            this.regCC &= ~(F.NEGATIVE | F.OVERFLOW | F.CARRY);
            this.regCC |= F.ZERO;
        }

        private negb = (): void=> {
            this.regB = this._neg(this.regB);
        }
        private comb = (): void=> {
            this.regB = this._com(this.regB);
        }
        private lsrb = (): void=> {
            this.regB = this._lsr(this.regB);
        }
        private rorb = (): void=> {
            this.regB = this._ror(this.regB);
        }
        private asrb = (): void=> {
            this.regB = this._asr(this.regB);
        }
        private aslb = (): void=> {
            this.regB = this._asl(this.regB);
        }
        private rolb = (): void=> {
            this.regB = this._rol(this.regB);
        }
        private decb = (): void=> {
            this.regB = this._dec(this.regB);
        }
        private incb = (): void=> {
            this.regB = this._inc(this.regB);
        }
        private tstb = (): void=> {
            this.regCC &= ~(F.ZERO | F.NEGATIVE | F.OVERFLOW);
            this._flagnz(this.regB);
        }

        private clrb = (): void=> {
            this.regB = 0;
            this.regCC &= ~(F.NEGATIVE | F.OVERFLOW | F.CARRY);
            this.regCC |= F.ZERO;
        }

        private negi = (): void=> { //0x60: /* NEG - indexed */
            var usAddr = this.M6809PostByte();
            var ucTemp = this.M6809ReadByte(usAddr);
            this.M6809WriteByte(usAddr, this._neg(ucTemp));
        }

        private comi = (): void=> { //0x63: /* COM - indexed */
            var usAddr = this.M6809PostByte();
            var ucTemp = this.M6809ReadByte(usAddr);
            this.M6809WriteByte(usAddr, this._com(ucTemp));
        }

        private lsri = (): void=> { //0x64: /* LSR - indexed */
            var usAddr = this.M6809PostByte();
            var ucTemp = this.M6809ReadByte(usAddr);
            this.M6809WriteByte(usAddr, this._lsr(ucTemp));
        }

        private rori = (): void=> { //0x66: /* ROR - indexed */
            var usAddr = this.M6809PostByte();
            var ucTemp = this.M6809ReadByte(usAddr);
            this.M6809WriteByte(usAddr, this._ror(ucTemp));
        }

        private asri = (): void=> { //0x67: /* ASR - indexed */
            var usAddr = this.M6809PostByte();
            var ucTemp = this.M6809ReadByte(usAddr);
            this.M6809WriteByte(usAddr, this._asr(ucTemp));
        }

        private asli = (): void=> { //0x68: /* ASL - indexed */
            var usAddr = this.M6809PostByte();
            var ucTemp = this.M6809ReadByte(usAddr);
            this.M6809WriteByte(usAddr, this._asl(ucTemp));
        }

        private roli = (): void=> { //0x69: /* ROL - indexed */
            var usAddr = this.M6809PostByte();
            var ucTemp = this.M6809ReadByte(usAddr);
            this.M6809WriteByte(usAddr, this._rol(ucTemp));
        }

        private deci = (): void=> { //0x6A: /* DEC - indexed */
            var usAddr = this.M6809PostByte();
            var ucTemp = this.M6809ReadByte(usAddr);
            this.M6809WriteByte(usAddr, this._dec(ucTemp));
        }

        private inci = (): void=> { //0x6C: /* INC - indexed */
            var usAddr = this.M6809PostByte();
            var ucTemp = this.M6809ReadByte(usAddr);
            this.M6809WriteByte(usAddr, this._inc(ucTemp));
        }

        private tsti = (): void=> { //0x6D: /* TST - indexed */
            var usAddr = this.M6809PostByte();
            this.regCC &= ~(F.ZERO | F.NEGATIVE | F.OVERFLOW);
            var val = this.M6809ReadByte(usAddr);
            this._flagnz(val);
        }

        private jmpi = (): void=> { //0x6E: /* JMP - indexed */
            this.regPC = this.M6809PostByte();
        }

        private clri = (): void=> { //0x6F: /* CLR - indexed */
            var usAddr = this.M6809PostByte();
            this.M6809WriteByte(usAddr, 0);
            this.regCC &= ~(F.OVERFLOW | F.CARRY | F.NEGATIVE);
            this.regCC |= F.ZERO;
        }

        private nege = (): void=> { //0x70: /* NEG - extended */
            var usAddr = this.nextPCWord();
            this.M6809WriteByte(usAddr, this._neg(this.M6809ReadByte(usAddr)));
        }

        private come = (): void=> { //0x73: /* COM - extended */
            var usAddr = this.nextPCWord();
            this.M6809WriteByte(usAddr, this._com(this.M6809ReadByte(usAddr)));
        }

        private lsre = (): void=> { //0x74: /* LSR - extended */
            var usAddr = this.nextPCWord();
            this.M6809WriteByte(usAddr, this._lsr(this.M6809ReadByte(usAddr)));
        }

        private rore = (): void=> { //0x76: /* ROR - extended */
            var usAddr = this.nextPCWord();
            this.M6809WriteByte(usAddr, this._ror(this.M6809ReadByte(usAddr)));
        }

        private asre = (): void=> { //0x77: /* ASR - extended */
            var usAddr = this.nextPCWord();
            this.M6809WriteByte(usAddr, this._asr(this.M6809ReadByte(usAddr)));
        }

        private asle = (): void=> { //0x78: /* ASL - extended */
            var usAddr = this.nextPCWord();
            this.M6809WriteByte(usAddr, this._asl(this.M6809ReadByte(usAddr)));
        }

        private role = (): void=> { //0x79: /* ROL - extended */
            var usAddr = this.nextPCWord();
            this.M6809WriteByte(usAddr, this._rol(this.M6809ReadByte(usAddr)));
        }

        private dece = (): void=> { //0x7A: /* DEC - extended */
            var usAddr = this.nextPCWord();
            this.M6809WriteByte(usAddr, this._dec(this.M6809ReadByte(usAddr)));
        }

        private ince = (): void=> { //0x7C: /* INC - extended */
            var usAddr = this.nextPCWord();
            this.M6809WriteByte(usAddr, this._inc(this.M6809ReadByte(usAddr)));
        }

        private tste = (): void=> { //0x7D: /* TST - extended */
            var usAddr = this.nextPCWord();
            var ucTemp = this.M6809ReadByte(usAddr);
            this.regCC &= ~(F.ZERO | F.NEGATIVE | F.OVERFLOW);
            this._flagnz(ucTemp);
        }

        private jmpe = (): void=> { //0x7E: /* JMP - extended */
            this.regPC = this.M6809ReadWord(this.regPC);
        }

        private clre = (): void=> { //0x7F: /* CLR - extended */
            var usAddr = this.nextPCWord();
            this.M6809WriteByte(usAddr, 0);
            this.regCC &= ~(F.CARRY | F.OVERFLOW | F.NEGATIVE);
            this.regCC |= F.ZERO;
        }

        private suba = (): void=> { //0x80: /* SUBA - immediate */
            this.regA = this._sub(this.regA, this.nextPCByte());
        }

        private cmpa = (): void=> { //0x81: /* CMPA - immediate */
            var ucTemp = this.nextPCByte();
            this._cmp(this.regA, ucTemp);
        }

        private sbca = (): void=> { //0x82: /* SBCA - immediate */
            var ucTemp = this.nextPCByte();
            this.regA = this._sbc(this.regA, ucTemp);
        }

        private subd = (): void=> { //0x83: /* SUBD - immediate */
            var usTemp = this.nextPCWord();
            this.setRegD(this._sub16(this.getRegD(), usTemp));
        }

        private anda = (): void=> { //0x84: /* ANDA - immediate */
            var ucTemp = this.nextPCByte();
            this.regA = this._and(this.regA, ucTemp);
        }

        private bita = (): void=> { //0x85: /* BITA - immediate */
            var ucTemp = this.nextPCByte();
            this._and(this.regA, ucTemp);
        }

        private lda = (): void=> { //0x86: /* LDA - immediate */
            this.regA = this.nextPCByte();
            this.regCC &= ~(F.ZERO | F.NEGATIVE | F.OVERFLOW);
            this._flagnz(this.regA);
        }

        private eora = (): void=> { //0x88: /* EORA - immediate */
            var ucTemp = this.nextPCByte();
            this.regA = this._eor(this.regA, ucTemp);
        }

        private adca = (): void=> { //0x89: /* ADCA - immediate */
            var ucTemp = this.nextPCByte();
            this.regA = this._adc(this.regA, ucTemp);
        }

        private ora = (): void=> { //0x8A: /* ORA - immediate */
            var ucTemp = this.nextPCByte();
            this.regA = this._or(this.regA, ucTemp);
        }

        private adda = (): void=> { //0x8B: /* ADDA - immediate */
            var ucTemp = this.nextPCByte();
            this.regA = this._add(this.regA, ucTemp);
        }

        private cmpx = (): void=> { //0x8C: /* CMPX - immediate */
            var usTemp = this.nextPCWord();
            this._cmp16(this.regX, usTemp);
        }

        private bsr = (): void=> { //0x8D: /* BSR */
            var sTemp = makeSignedByte(this.nextPCByte());
            this.M6809PUSHW(this.regPC);
            this.regPC += sTemp;
        }

        private ldx = (): void=> { //0x8E: /* LDX - immediate */
            var usTemp = this.nextPCWord();
            this.regX = usTemp;
            this._flagnz16(usTemp);
            this.regCC &= ~F.OVERFLOW;
        }

        private subad = (): void=> { //0x90: /* SUBA - direct */
            var usAddr = this.regDP * 256 + this.nextPCByte(); /* Address of byte to negate */
            var ucTemp = this.M6809ReadByte(usAddr);
            this.regA = this._sub(this.regA, ucTemp);
        }

        private cmpad = (): void=> { //0x91: /* CMPA - direct */
            var usAddr = this.regDP * 256 + this.nextPCByte(); /* Address of byte to negate */
            var ucTemp = this.M6809ReadByte(usAddr);
            this._cmp(this.regA, ucTemp);
        }

        private sbcad = (): void=> { //0x92: /* SBCA - direct */
            var usAddr = this.regDP * 256 + this.nextPCByte(); /* Address of byte to negate */
            var ucTemp = this.M6809ReadByte(usAddr);
            this.regA = this._sbc(this.regA, ucTemp);
        }

        private subdd = (): void=> { //0x93: /* SUBD - direct */
            var usAddr = this.regDP * 256 + this.nextPCByte(); /* Address of byte to negate */
            var usTemp = this.M6809ReadWord(usAddr);
            this.setRegD(this._sub16(this.getRegD(), usTemp));
        }

        private andad = (): void=> { //0x94: /* ANDA - direct */
            var usAddr = this.regDP * 256 + this.nextPCByte(); /* Address of byte to negate */
            var ucTemp = this.M6809ReadByte(usAddr);
            this.regA = this._and(this.regA, ucTemp);
        }

        private bitad = (): void=> { //0x95: /* BITA - direct */
            var usAddr = this.regDP * 256 + this.nextPCByte(); /* Address of byte to negate */
            var ucTemp = this.M6809ReadByte(usAddr);
            this._and(this.regA, ucTemp);
        }

        private ldad = (): void=> { //0x96: /* LDA - direct */
            var usAddr = this.regDP * 256 + this.nextPCByte(); /* Address of byte to negate */
            this.regA = this.M6809ReadByte(usAddr);
            this.regCC &= ~(F.ZERO | F.NEGATIVE | F.OVERFLOW);
            this._flagnz(this.regA);
        }

        private stad = (): void=> { //0x97: /* STA - direct */
            var usAddr = this.regDP * 256 + this.nextPCByte(); /* Address of byte to negate */
            this.M6809WriteByte(usAddr, this.regA);
            this.regCC &= ~(F.ZERO | F.NEGATIVE | F.OVERFLOW);
            this._flagnz(this.regA);
        }

        private eorad = (): void=> { //0x98: /* EORA - direct */
            var usAddr = this.regDP * 256 + this.nextPCByte(); /* Address of byte to negate */
            var ucTemp = this.M6809ReadByte(usAddr);
            this.regA = this._eor(this.regA, ucTemp);
        }

        private adcad = (): void=> { //0x99: /* ADCA - direct */
            var usAddr = this.regDP * 256 + this.nextPCByte(); /* Address of byte to negate */
            var ucTemp = this.M6809ReadByte(usAddr);
            this.regA = this._adc(this.regA, ucTemp);
        }

        private orad = (): void=> { //0x9A: /* ORA - direct */
            var usAddr = this.regDP * 256 + this.nextPCByte(); /* Address of byte to negate */
            var ucTemp = this.M6809ReadByte(usAddr);
            this.regA = this._or(this.regA, ucTemp);
        }

        private addad = (): void=> { //0x9B: /* ADDA - direct */
            var usAddr = this.regDP * 256 + this.nextPCByte(); /* Address of byte to negate */
            var ucTemp = this.M6809ReadByte(usAddr);
            this.regA = this._add(this.regA, ucTemp);
        }

        private cmpxd = (): void=> { //0x9C: /* CMPX - direct */
            var usAddr = this.regDP * 256 + this.nextPCByte(); /* Address of byte to negate */
            var usTemp = this.M6809ReadWord(usAddr);
            this._cmp16(this.regX, usTemp);
        }

        private jsrd = (): void=> { //0x9D: /* JSR - direct */
            var usAddr = this.regDP * 256 + this.nextPCByte(); /* Address of byte to negate */
            this.M6809PUSHW(this.regPC);
            this.regPC = usAddr;
        }

        private ldxd = (): void=> { //0x9E: /* LDX - direct */
            var usAddr = this.regDP * 256 + this.nextPCByte(); /* Address of byte to negate */
            this.regX = this.M6809ReadWord(usAddr);
            this._flagnz16(this.regX);
            this.regCC &= ~F.OVERFLOW;
        }

        private stxd = (): void=> { //0x9F: /* STX - direct */
            var usAddr = this.regDP * 256 + this.nextPCByte(); /* Address of byte to negate */
            this.M6809WriteWord(usAddr, this.regX);
            this._flagnz16(this.regX);
            this.regCC &= ~F.OVERFLOW;
        }

        private subax = (): void=> { //0xA0: /* SUBA - indexed */
            var usAddr = this.M6809PostByte();
            var ucTemp = this.M6809ReadByte(usAddr);
            this.regA = this._sub(this.regA, ucTemp);
        }

        private cmpax = (): void=> { //0xA1: /* CMPA - indexed */
            var usAddr = this.M6809PostByte();
            var ucTemp = this.M6809ReadByte(usAddr);
            this._cmp(this.regA, ucTemp);
        }

        private sbcax = (): void=> { //0xA2: /* SBCA - indexed */
            var usAddr = this.M6809PostByte();
            var ucTemp = this.M6809ReadByte(usAddr);
            this.regA = this._sbc(this.regA, ucTemp);
        }

        private subdx = (): void=> { //0xA3: /* SUBD - indexed */
            var usAddr = this.M6809PostByte();
            var usTemp = this.M6809ReadWord(usAddr);
            this.setRegD(this._sub16(this.getRegD(), usTemp));
        }

        private andax = (): void=> { //0xA4: /* ANDA - indexed */
            var usAddr = this.M6809PostByte();
            var ucTemp = this.M6809ReadByte(usAddr);
            this.regA = this._and(this.regA, ucTemp);
        }

        private bitax = (): void=> { //0xA5: /* BITA - indexed */
            var usAddr = this.M6809PostByte();
            var ucTemp = this.M6809ReadByte(usAddr);
            this._and(this.regA, ucTemp);
        }

        private ldax = (): void=> { //0xA6: /* LDA - indexed */
            var usAddr = this.M6809PostByte();
            this.regA = this.M6809ReadByte(usAddr);
            this.regCC &= ~(F.ZERO | F.NEGATIVE | F.OVERFLOW);
            this._flagnz(this.regA);
        }

        private stax = (): void=> { //0xA7: /* STA - indexed */
            var usAddr = this.M6809PostByte();
            this.M6809WriteByte(usAddr, this.regA);
            this.regCC &= ~(F.ZERO | F.NEGATIVE | F.OVERFLOW);
            this._flagnz(this.regA);
        }

        private eorax = (): void=> { //0xA8: /* EORA - indexed */
            var usAddr = this.M6809PostByte();
            var ucTemp = this.M6809ReadByte(usAddr);
            this.regA = this._eor(this.regA, ucTemp);
        }

        private adcax = (): void=> { //0xA9: /* ADCA - indexed */
            var usAddr = this.M6809PostByte();
            var ucTemp = this.M6809ReadByte(usAddr);
            this.regA = this._adc(this.regA, ucTemp);
        }

        private orax = (): void=> { //0xAA: /* ORA - indexed */
            var usAddr = this.M6809PostByte();
            var ucTemp = this.M6809ReadByte(usAddr);
            this.regA = this._or(this.regA, ucTemp);
        }

        private addax = (): void=> { //0xAB: /* ADDA - indexed */
            var usAddr = this.M6809PostByte();
            var ucTemp = this.M6809ReadByte(usAddr);
            this.regA = this._add(this.regA, ucTemp);
        }

        private cmpxx = (): void=> { //0xAC: /* CMPX - indexed */
            var usAddr = this.M6809PostByte();
            var usTemp = this.M6809ReadWord(usAddr);
            this._cmp16(this.regX, usTemp);
        }

        private jsrx = (): void=> { //0xAD: /* JSR - indexed */
            var usAddr = this.M6809PostByte();
            this.M6809PUSHW(this.regPC);
            this.regPC = usAddr;
        }

        private ldxx = (): void=> { //0xAE: /* LDX - indexed */
            var usAddr = this.M6809PostByte();
            this.regX = this.M6809ReadWord(usAddr);
            this._flagnz16(this.regX);
            this.regCC &= ~F.OVERFLOW;
        }

        private stxx = (): void=> { //0xAF: /* STX - indexed */
            var usAddr = this.M6809PostByte();
            this.M6809WriteWord(usAddr, this.regX);
            this._flagnz16(this.regX);
            this.regCC &= ~F.OVERFLOW;
        }

        private subae = (): void=> { //0xB0: /* SUBA - extended */
            var usAddr = this.nextPCWord();
            this.regA = this._sub(this.regA, this.M6809ReadByte(usAddr));
        }

        private cmpae = (): void=> { //0xB1: /* CMPA - extended */
            var usAddr = this.nextPCWord();
            this._cmp(this.regA, this.M6809ReadByte(usAddr));
        }

        private sbcae = (): void=> { //0xB2: /* SBCA - extended */
            var usAddr = this.nextPCWord();
            this.regA = this._sbc(this.regA, this.M6809ReadByte(usAddr));
        }

        private subde = (): void=> { //0xB3: /* SUBD - extended */
            var usAddr = this.nextPCWord();
            this.setRegD(this._sub16(this.getRegD(), this.M6809ReadWord(usAddr)));
        }

        private andae = (): void=> { //0xB4: /* ANDA - extended */
            var usAddr = this.nextPCWord();
            this.regA = this._and(this.regA, this.M6809ReadByte(usAddr));
        }

        private bitae = (): void=> { //0xB5: /* BITA - extended */
            var usAddr = this.nextPCWord();
            this._and(this.regA, this.M6809ReadByte(usAddr));
        }

        private ldae = (): void=> { //0xB6: /* LDA - extended */
            var usAddr = this.nextPCWord();
            this.regA = this.M6809ReadByte(usAddr);
            this.regCC &= ~(F.ZERO | F.NEGATIVE | F.OVERFLOW);
            this._flagnz(this.regA);
        }

        private stae = (): void=> { //0xB7: /* STA - extended */
            var usAddr = this.nextPCWord();
            this.M6809WriteByte(usAddr, this.regA);
            this.regCC &= ~(F.ZERO | F.NEGATIVE | F.OVERFLOW);
            this._flagnz(this.regA);
        }

        private eorae = (): void=> { //0xB8: /* EORA - extended */
            var usAddr = this.nextPCWord();
            this.regA = this._eor(this.regA, this.M6809ReadByte(usAddr));
        }

        private adcae = (): void=> { //0xB9: /* ADCA - extended */
            var usAddr = this.nextPCWord();
            this.regA = this._adc(this.regA, this.M6809ReadByte(usAddr));
        }

        private orae = (): void=> { //0xBA: /* ORA - extended */
            var usAddr = this.nextPCWord();
            this.regA = this._or(this.regA, this.M6809ReadByte(usAddr));
        }

        private addae = (): void=> { //0xBB: /* ADDA - extended */
            var usAddr = this.nextPCWord();
            this.regA = this._add(this.regA, this.M6809ReadByte(usAddr));
        }

        private cmpxe = (): void=> { //0xBC: /* CMPX - extended */
            var usAddr = this.nextPCWord();
            this._cmp16(this.regX, this.M6809ReadWord(usAddr));
        }

        private jsre = (): void=> { //0xBD: /* JSR - extended */
            var usAddr = this.nextPCWord();
            this.M6809PUSHW(this.regPC);
            this.regPC = usAddr;
        }

        private ldxe = (): void=> { //0xBE: /* LDX - extended */
            var usAddr = this.nextPCWord();
            this.regX = this.M6809ReadWord(usAddr);
            this._flagnz16(this.regX);
            this.regCC &= ~F.OVERFLOW;
        }

        private stxe = (): void=> { //0xBF: /* STX - extended */
            var usAddr = this.nextPCWord();
            this.M6809WriteWord(usAddr, this.regX);
            this._flagnz16(this.regX);
            this.regCC &= ~F.OVERFLOW;
        }

        private subb = (): void=> { //0xC0: /* SUBB - immediate */
            var ucTemp = this.nextPCByte();
            this.regB = this._sub(this.regB, ucTemp);
        }

        private cmpb = (): void=> { //0xC1: /* CMPB - immediate */
            var ucTemp = this.nextPCByte();
            this._cmp(this.regB, ucTemp);
        }

        private sbcb = (): void=> { //0xC2: /* SBCB - immediate */
            var ucTemp = this.nextPCByte();
            this.regB = this._sbc(this.regB, ucTemp);
        }

        private addd = (): void=> { //0xC3: /* ADDD - immediate */
            var usTemp = this.nextPCWord();
            this.setRegD(this._add16(this.getRegD(), usTemp));
        }

        private andb = (): void=> { //0xC4: /* ANDB - immediate */
            var ucTemp = this.nextPCByte();
            this.regB = this._and(this.regB, ucTemp);
        }

        private bitb = (): void=> { //0xC5: /* BITB - immediate */
            var ucTemp = this.nextPCByte();
            this._and(this.regB, ucTemp);
        }

        private ldb = (): void=> { //0xC6: /* LDB - immediate */
            this.regB = this.nextPCByte();
            this.regCC &= ~(F.ZERO | F.NEGATIVE | F.OVERFLOW);
            this._flagnz(this.regB);
        }

        private eorb = (): void=> { //0xC8: /* EORB - immediate */
            var ucTemp = this.nextPCByte();
            this.regB = this._eor(this.regB, ucTemp);
        }

        private adcb = (): void=> { //0xC9: /* ADCB - immediate */
            var ucTemp = this.nextPCByte();
            this.regB = this._adc(this.regB, ucTemp);
        }

        private orb = (): void=> { //0xCA: /* ORB - immediate */
            var ucTemp = this.nextPCByte();
            this.regB = this._or(this.regB, ucTemp);
        }

        private addb = (): void=> { //0xCB: /* ADDB - immediate */
            var ucTemp = this.nextPCByte();
            this.regB = this._add(this.regB, ucTemp);
        }

        private ldd = (): void=> { //0xCC: /* LDD - immediate */
            var d = this.nextPCWord();
            this.setRegD(d);
            this._flagnz16(d);
            this.regCC &= ~F.OVERFLOW;
        }

        private ldu = (): void=> { //0xCE: /* LDU - immediate */
            this.regU = this.nextPCWord();
            this._flagnz16(this.regU);
            this.regCC &= ~F.OVERFLOW;
        }

        private sbbd = (): void=> { //0xD0: /* SUBB - direct */
            var usAddr = this.regDP * 256 + this.nextPCByte();
            var ucTemp = this.M6809ReadByte(usAddr);
            this.regB = this._sub(this.regB, ucTemp);
        }

        private cmpbd = (): void=> { //0xD1: /* CMPB - direct */
            var usAddr = this.regDP * 256 + this.nextPCByte();
            var ucTemp = this.M6809ReadByte(usAddr);
            this._cmp(this.regB, ucTemp);
        }

        private sbcd = (): void=> { //0xD2: /* SBCB - direct */
            var usAddr = this.regDP * 256 + this.nextPCByte();
            var ucTemp = this.M6809ReadByte(usAddr);
            this.regB = this._sbc(this.regB, ucTemp);
        }

        private adddd = (): void=> { //0xD3: /* ADDD - direct */
            var usAddr = this.regDP * 256 + this.nextPCByte();
            var usTemp = this.M6809ReadWord(usAddr);
            this.setRegD(this._add16(this.getRegD(), usTemp));
        }

        private andbd = (): void=> { //0xD4: /* ANDB - direct */
            var usAddr = this.regDP * 256 + this.nextPCByte();
            var ucTemp = this.M6809ReadByte(usAddr);
            this.regB = this._and(this.regB, ucTemp);
        }

        private bitbd = (): void=> { //0xD5: /* BITB - direct */
            var usAddr = this.regDP * 256 + this.nextPCByte();
            var ucTemp = this.M6809ReadByte(usAddr);
            this._and(this.regB, ucTemp);
        }

        private ldbd = (): void=> { //0xD6: /* LDB - direct */
            var usAddr = this.regDP * 256 + this.nextPCByte();
            this.regB = this.M6809ReadByte(usAddr);
            this.regCC &= ~(F.ZERO | F.NEGATIVE | F.OVERFLOW);
            this._flagnz(this.regB);
        }

        private stbd = (): void=> { //0xD7: /* STB - direct */
            var usAddr = this.regDP * 256 + this.nextPCByte();
            this.M6809WriteByte(usAddr, this.regB);
            this.regCC &= ~(F.ZERO | F.NEGATIVE | F.OVERFLOW);
            this._flagnz(this.regB);
        }

        private eorbd = (): void=> { //0xD8: /* EORB - direct */
            var usAddr = this.regDP * 256 + this.nextPCByte();
            var ucTemp = this.M6809ReadByte(usAddr);
            this.regB = this._eor(this.regB, ucTemp);
        }

        private adcbd = (): void=> { //0xD9: /* ADCB - direct */
            var usAddr = this.regDP * 256 + this.nextPCByte();
            var ucTemp = this.M6809ReadByte(usAddr);
            this.regB = this._adc(this.regB, ucTemp);
        }

        private orbd = (): void=> { //0xDA: /* ORB - direct */
            var usAddr = this.regDP * 256 + this.nextPCByte();
            var ucTemp = this.M6809ReadByte(usAddr);
            this.regB = this._or(this.regB, ucTemp);
        }

        private addbd = (): void=> { //0xDB: /* ADDB - direct */
            var usAddr = this.regDP * 256 + this.nextPCByte();
            var ucTemp = this.M6809ReadByte(usAddr);
            this.regB = this._add(this.regB, ucTemp);
        }

        private lddd = (): void=> { //0xDC: /* LDD - direct */
            var usAddr = this.regDP * 256 + this.nextPCByte();
            var d = this.M6809ReadWord(usAddr);
            this.setRegD(d);
            this._flagnz16(d);
            this.regCC &= ~F.OVERFLOW;
        }

        private stdd = (): void=> { //0xDD: /* STD - direct */
            var usAddr = this.regDP * 256 + this.nextPCByte();
            var d = this.getRegD();
            this.M6809WriteWord(usAddr, d);
            this._flagnz16(d);
            this.regCC &= ~F.OVERFLOW;
        }

        private ldud = (): void=> { //0xDE: /* LDU - direct */
            var usAddr = this.regDP * 256 + this.nextPCByte();
            this.regU = this.M6809ReadWord(usAddr);
            this._flagnz16(this.regU);
            this.regCC &= ~F.OVERFLOW;
        }

        private stud = (): void=> { //0xDF: /* STU - direct */
            var usAddr = this.regDP * 256 + this.nextPCByte();
            this.M6809WriteWord(usAddr, this.regU);
            this._flagnz16(this.regU);
            this.regCC &= ~F.OVERFLOW;
        }

        private subbx = (): void=> { //0xE0: /* SUBB - indexed */
            var usAddr = this.M6809PostByte();
            var ucTemp = this.M6809ReadByte(usAddr);
            this.regB = this._sub(this.regB, ucTemp);
        }

        private cmpbx = (): void=> { //0xE1: /* CMPB - indexed */
            var usAddr = this.M6809PostByte();
            var ucTemp = this.M6809ReadByte(usAddr);
            this._cmp(this.regB, ucTemp);
        }

        private sbcbx = (): void=> { //0xE2: /* SBCB - indexed */
            var usAddr = this.M6809PostByte();
            var ucTemp = this.M6809ReadByte(usAddr);
            this.regB = this._sbc(this.regB, ucTemp);
        }

        private adddx = (): void=> { //0xE3: /* ADDD - indexed */
            var usAddr = this.M6809PostByte();
            var usTemp = this.M6809ReadWord(usAddr);
            this.setRegD(this._add16(this.getRegD(), usTemp));
        }

        private andbx = (): void=> { //0xE4: /* ANDB - indexed */
            var usAddr = this.M6809PostByte();
            var ucTemp = this.M6809ReadByte(usAddr);
            this.regB = this._and(this.regB, ucTemp);
        }

        private bitbx = (): void=> { //0xE5: /* BITB - indexed */
            var usAddr = this.M6809PostByte();
            var ucTemp = this.M6809ReadByte(usAddr);
            this._and(this.regB, ucTemp);
        }

        private ldbx = (): void=> { //0xE6: /* LDB - indexed */
            var usAddr = this.M6809PostByte();
            this.regB = this.M6809ReadByte(usAddr);
            this.regCC &= ~(F.ZERO | F.NEGATIVE | F.OVERFLOW);
            this._flagnz(this.regB);
        }

        private stbx = (): void=> { //0xE7: /* STB - indexed */
            var usAddr = this.M6809PostByte();
            this.M6809WriteByte(usAddr, this.regB);
            this.regCC &= ~(F.ZERO | F.NEGATIVE | F.OVERFLOW);
            this._flagnz(this.regB);
        }

        private eorbx = (): void=> { //0xE8: /* EORB - indexed */
            var usAddr = this.M6809PostByte();
            var ucTemp = this.M6809ReadByte(usAddr);
            this.regB = this._eor(this.regB, ucTemp);
        }

        private adcbx = (): void=> { //0xE9: /* ADCB - indexed */
            var usAddr = this.M6809PostByte();
            var ucTemp = this.M6809ReadByte(usAddr);
            this.regB = this._adc(this.regB, ucTemp);
        }

        private orbx = (): void=> { //0xEA: /* ORB - indexed */
            var usAddr = this.M6809PostByte();
            var ucTemp = this.M6809ReadByte(usAddr);
            this.regB = this._or(this.regB, ucTemp);
        }

        private addbx = (): void=> { //0xEB: /* ADDB - indexed */
            var usAddr = this.M6809PostByte();
            var ucTemp = this.M6809ReadByte(usAddr);
            this.regB = this._add(this.regB, ucTemp);
        }

        private lddx = (): void=> { //0xEC: /* LDD - indexed */
            var usAddr = this.M6809PostByte();
            var d = this.M6809ReadWord(usAddr);
            this.setRegD(d);
            this._flagnz16(d);
            this.regCC &= ~F.OVERFLOW;
        }

        private stdx = (): void=> { //0xED: /* STD - indexed */
            var usAddr = this.M6809PostByte();
            var d = this.getRegD();
            this.M6809WriteWord(usAddr, d);
            this._flagnz16(d);
            this.regCC &= ~F.OVERFLOW;
        }

        private ldux = (): void=> { //0xEE: /* LDU - indexed */
            var usAddr = this.M6809PostByte();
            this.regU = this.M6809ReadWord(usAddr);
            this._flagnz16(this.regU);
            this.regCC &= ~F.OVERFLOW;
        }

        private stux = (): void=> { //0xEF: /* STU - indexed */
            var usAddr = this.M6809PostByte();
            this.M6809WriteWord(usAddr, this.regU);
            this._flagnz16(this.regU);
            this.regCC &= ~F.OVERFLOW;
        }

        private subbe = (): void=> { //0xF0: /* SUBB - extended */
            var usAddr = this.nextPCWord();
            var ucTemp = this.M6809ReadByte(usAddr);
            this.regB = this._sub(this.regB, ucTemp);
        }

        private cmpbe = (): void=> { //0xF1: /* CMPB - extended */
            var usAddr = this.nextPCWord();
            var ucTemp = this.M6809ReadByte(usAddr);
            this._cmp(this.regB, ucTemp);
        }

        private sbcbe = (): void=> { //0xF2: /* SBCB - extended */
            var usAddr = this.nextPCWord();
            var ucTemp = this.M6809ReadByte(usAddr);
            this.regB = this._sbc(this.regB, ucTemp);
        }

        private addde = (): void=> { //0xF3: /* ADDD - extended */
            var usAddr = this.nextPCWord();
            var usTemp = this.M6809ReadWord(usAddr);
            this.setRegD(this._add16(this.getRegD(), usTemp));
        }

        private andbe = (): void=> { //0xF4: /* ANDB - extended */
            var usAddr = this.nextPCWord();
            var ucTemp = this.M6809ReadByte(usAddr);
            this.regB = this._and(this.regB, ucTemp);
        }

        private bitbe = (): void=> { //0xF5: /* BITB - extended */
            var usAddr = this.nextPCWord();
            var ucTemp = this.M6809ReadByte(usAddr);
            this._and(this.regB, ucTemp);
        }

        private ldbe = (): void=> { //0xF6: /* LDB - extended */
            var usAddr = this.nextPCWord();
            this.regB = this.M6809ReadByte(usAddr);
            this.regCC &= ~(F.ZERO | F.NEGATIVE | F.OVERFLOW);
            this._flagnz(this.regB);
        }

        private stbe = (): void=> { //0xF7: /* STB - extended */
            var usAddr = this.nextPCWord();
            this.M6809WriteByte(usAddr, this.regB);
            this.regCC &= ~(F.ZERO | F.NEGATIVE | F.OVERFLOW);
            this._flagnz(this.regB);
        }

        private eorbe = (): void=> { //0xF8: /* EORB - extended */
            var usAddr = this.nextPCWord();
            var ucTemp = this.M6809ReadByte(usAddr);
            this.regB = this._eor(this.regB, ucTemp);
        }

        private adcbe = (): void=> { //0xF9: /* ADCB - extended */
            var usAddr = this.nextPCWord();
            var ucTemp = this.M6809ReadByte(usAddr);
            this.regB = this._adc(this.regB, ucTemp);
        }

        private orbe = (): void=> { //0xFA: /* ORB - extended */
            var usAddr = this.nextPCWord();
            var ucTemp = this.M6809ReadByte(usAddr);
            this.regB = this._or(this.regB, ucTemp);
        }

        private addbe = (): void=> { //0xFB: /* ADDB - extended */
            var usAddr = this.nextPCWord();
            var ucTemp = this.M6809ReadByte(usAddr);
            this.regB = this._add(this.regB, ucTemp);
        }

        private ldde = (): void=> { //0xFC: /* LDD - extended */
            var usAddr = this.nextPCWord();
            var val = this.M6809ReadWord(usAddr);
            this.setRegD(val);
            this._flagnz16(val);
            this.regCC &= ~F.OVERFLOW;
        }

        private stde = (): void=> { //0xFD: /* STD - extended */
            var usAddr = this.nextPCWord();
            var d = this.getRegD();
            this.M6809WriteWord(usAddr, d);
            this._flagnz16(d);
            this.regCC &= ~F.OVERFLOW;
        }

        private ldue = (): void=> { //0xFE: /* LDU - extended */
            var usAddr = this.nextPCWord();
            this.regU = this.M6809ReadWord(usAddr);
            this._flagnz16(this.regU);
            this.regCC &= ~F.OVERFLOW;
        }

        private stue = (): void=> { //0xFF: /* STU - extended */
            var usAddr = this.nextPCWord();
            this.M6809WriteWord(usAddr, this.regU);
            this._flagnz16(this.regU);
            this.regCC &= ~F.OVERFLOW;
        }

        private instructions: { (): void; }[] = [
            this.neg, null, null, this.com, this.lsr, null, this.ror, this.asr, // 00..07
            this.asl, this.rol, this.dec, null, this.inc, this.tst, this.jmp, this.clr, // 08..0f
            this.p10, this.p11, this.nop, this.sync, null, null, this.lbra, this.lbsr, // 10..17
            null, this.daa, this.orcc, null, this.andcc, this.sex, this.exg, this.tfr, // 18..1f
            this.bra, this.brn, this.bhi, this.bls, this.bcc, this.bcs, this.bne, this.beq, // 20..27
            this.bvc, this.bvs, this.bpl, this.bmi, this.bge, this.blt, this.bgt, this.ble, // 28..2f
            this.leax, this.leay, this.leas, this.leau, this.pshs, this.puls, this.pshu, this.pulu, // 30..37
            null, this.rts, this.abx, this.rti, this.cwai, this.mul, null, this.swi, // 38..3f
            this.nega, null, null, this.coma, this.lsra, null, this.rora, this.asra, // 40..47
            this.asla, this.rola, this.deca, null, this.inca, this.tsta, null, this.clra, // 48..4f
            this.negb, null, null, this.comb, this.lsrb, null, this.rorb, this.asrb, // 50..57
            this.aslb, this.rolb, this.decb, null, this.incb, this.tstb, null, this.clrb, // 58..5f
            this.negi, null, null, this.comi, this.lsri, null, this.rori, this.asri, // 60..67
            this.asli, this.roli, this.deci, null, this.inci, this.tsti, this.jmpi, this.clri, // 68..6f
            this.nege, null, null, this.come, this.lsre, null, this.rore, this.asre, // 70..77
            this.asle, this.role, this.dece, null, this.ince, this.tste, this.jmpe, this.clre, // 78..7f
            this.suba, this.cmpa, this.sbca, this.subd, this.anda, this.bita, this.lda, null, // 80..87
            this.eora, this.adca, this.ora, this.adda, this.cmpx, this.bsr, this.ldx, null, // 88..8f
            this.subad, this.cmpad, this.sbcad, this.subdd, this.andad, this.bitad, this.ldad, this.stad, // 90..97
            this.eorad, this.adcad, this.orad, this.addad, this.cmpxd, this.jsrd, this.ldxd, this.stxd, // 98..9f
            this.subax, this.cmpax, this.sbcax, this.subdx, this.andax, this.bitax, this.ldax, this.stax, // a0..a7
            this.eorax, this.adcax, this.orax, this.addax, this.cmpxx, this.jsrx, this.ldxx, this.stxx, // a8..af
            this.subae, this.cmpae, this.sbcae, this.subde, this.andae, this.bitae, this.ldae, this.stae, // b0..b7
            this.eorae, this.adcae, this.orae, this.addae, this.cmpxe, this.jsre, this.ldxe, this.stxe, // b8..bf
            this.subb, this.cmpb, this.sbcb, this.addd, this.andb, this.bitb, this.ldb, this.eorb, // c0..c7
            this.eorb, this.adcb, this.orb, this.addb, this.ldd, null, this.ldu, null, // c8..cf
            this.sbbd, this.cmpbd, this.sbcd, this.adddd, this.andbd, this.bitbd, this.ldbd, this.stbd, // d0..d7
            this.eorbd, this.adcbd, this.orbd, this.addbd, this.lddd, this.stdd, this.ldud, this.stud, // d8..df
            this.subbx, this.cmpbx, this.sbcbx, this.adddx, this.andbx, this.bitbx, this.ldbx, this.stbx, // e0..e7
            this.eorbx, this.adcbx, this.orbx, this.addbx, this.lddx, this.stdx, this.ldux, this.stux, // e8..ef
            this.subbe, this.cmpbe, this.sbcbe, this.addde, this.andbe, this.bitbe, this.ldbe, this.stbe, // f0..f7
            this.eorbe, this.adcbe, this.orbe, this.addbe, this.ldde, this.stde, this.ldue, this.stue // f8..ff        
        ];

        public mnemonics: string[] = [
            'neg  ', '     ', '     ', 'com  ', 'lsr  ', '     ', 'ror  ', 'asr  ', // 00..07
            'asl  ', 'rol  ', 'dec  ', '     ', 'inc  ', 'tst  ', 'jmp  ', 'clr  ', // 08..0f
            'p10  ', 'p11  ', 'nop  ', 'sync ', '     ', '     ', 'lbra ', 'lbsr ', // 10..17
            '     ', 'daa  ', 'orcc ', '     ', 'andcc', 'sex  ', 'exg  ', 'tfr  ', // 18..1f
            'bra  ', 'brn  ', 'bhi  ', 'bls  ', 'bcc  ', 'bcs  ', 'bne  ', 'beq  ', // 20..27
            'bvc  ', 'bvs  ', 'bpl  ', 'bmi  ', 'bge  ', 'blt  ', 'bgt  ', 'ble  ', // 28..2f
            'leax ', 'leay ', 'leas ', 'leau ', 'pshs ', 'puls ', 'pshu ', 'pulu ', // 30..37
            '     ', 'rts  ', 'abx  ', 'rti  ', 'cwai ', 'mul  ', '     ', 'swi  ', // 38..3f
            'nega ', '     ', '     ', 'coma ', 'lsra ', '     ', 'rora ', 'asra ', // 40..47
            'asla ', 'rola ', 'deca ', '     ', 'inca ', 'tsta ', '     ', 'clra ', // 48..4f
            'negb ', '     ', '     ', 'comb ', 'lsrb ', '     ', 'rorb ', 'asrb ', // 50..57
            'aslb ', 'rolb ', 'decb ', '     ', 'incb ', 'tstb ', '     ', 'clrb ', // 58..5f
            'negi ', '     ', '     ', 'comi ', 'lsri ', '     ', 'rori ', 'asri ', // 60..67
            'asli ', 'roli ', 'deci ', '     ', 'inci ', 'tsti ', 'jmpi ', 'clri ', // 68..6f
            'nege ', '     ', '     ', 'come ', 'lsre ', '     ', 'rore ', 'asre ', // 70..77
            'asle ', 'role ', 'dece ', '     ', 'ince ', 'tste ', 'jmpe ', 'clre ', // 78..7f
            'suba ', 'cmpa ', 'sbca ', 'subd ', 'anda ', 'bita ', 'lda  ', '     ', // 80..87
            'eora ', 'adca ', 'ora  ', 'adda ', 'cmpx ', 'bsr  ', 'ldx  ', '     ', // 88..8f
            'subad', 'cmpad', 'sbcad', 'subdd', 'andad', 'bitad', 'ldad ', 'stad ', // 90..97
            'eorad', 'adcad', 'orad ', 'addad', 'cmpxd', 'jsrd ', 'ldxd ', 'stxd ', // 98..9f
            'subax', 'cmpax', 'sbcax', 'subdx', 'andax', 'bitax', 'ldax ', 'stax ', // a0..a7
            'eorax', 'adcax', 'orax ', 'addax', 'cmpxx', 'jsrx ', 'ldxx ', 'stxx ', // a8..af
            'subae', 'cmpae', 'sbcae', 'subde', 'andae', 'bitae', 'ldae ', 'stae ', // b0..b7
            'eorae', 'adcae', 'orae ', 'addae', 'cmpxe', 'jsre ', 'ldxe ', 'stxe ', // b8..bf
            'subb ', 'cmpb ', 'sbcb ', 'addd ', 'andb ', 'bitb ', 'ldb  ', 'eorb ', // c0..c7
            'eorb ', 'adcb ', 'orb  ', 'addb ', 'ldd  ', '     ', 'ldu  ', '     ', // c8..cf
            'sbbd ', 'cmpbd', 'sbcd ', 'adddd', 'andbd', 'bitbd', 'ldbd ', 'stbd ', // d0..d7
            'eorbd', 'adcbd', 'orbd ', 'addbd', 'lddd ', 'stdd ', 'ldud ', 'stud ', // d8..df
            'subbx', 'cmpbx', 'sbcbx', 'adddx', 'andbx', 'bitbx', 'ldbx ', 'stbx ', // e0..e7
            'eorbx', 'adcbx', 'orbx ', 'addbx', 'lddx ', 'stdx ', 'ldux ', 'stux ', // e8..ef
            'subbe', 'cmpbe', 'sbcbe', 'addde', 'andbe', 'bitbe', 'ldbe ', 'stbe ', // f0..f7
            'eorbe', 'adcbe', 'orbe ', 'addbe', 'ldde ', 'stde ', 'ldue ', 'stue ' // f8..ff        
        ];
    }
}