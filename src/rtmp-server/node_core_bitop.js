// //MIT License

// Copyright (c) 2015-2020 Chen Mingliang, node-media-server

// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.
//

class Bitop {
  constructor(buffer) {
    this.buffer = buffer;
    this.buflen = buffer.length;
    this.bufpos = 0;
    this.bufoff = 0;
    this.iserro = false;
  }

  read(n) {
    let v = 0;
    let d = 0;
    while (n) {
      if (n < 0 || this.bufpos >= this.buflen) {
        this.iserro = true;
        return 0;
      }

      this.iserro = false;
      d = this.bufoff + n > 8 ? 8 - this.bufoff : n;

      v <<= d;
      v +=
        (this.buffer[this.bufpos] >> (8 - this.bufoff - d)) & (0xff >> (8 - d));

      this.bufoff += d;
      n -= d;

      if (this.bufoff == 8) {
        this.bufpos++;
        this.bufoff = 0;
      }
    }
    return v;
  }

  look(n) {
    let p = this.bufpos;
    let o = this.bufoff;
    let v = this.read(n);
    this.bufpos = p;
    this.bufoff = o;
    return v;
  }

  read_golomb() {
    let n;
    for (n = 0; this.read(1) == 0 && !this.iserro; n++);
    return (1 << n) + this.read(n) - 1;
  }
}

module.exports = Bitop;
