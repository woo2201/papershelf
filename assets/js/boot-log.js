/* Adapted from https://github.com/bas3line/ascii/blob/main/src/pieces/boot-log.ts

MIT License

Copyright (c) 2026 bas3line (https://github.com/bas3line)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
(() => {
  "use strict";

  const MEMORY = 16384; // MB
  const MEM_AT = 0.4; // when the memory test starts
  const TEST = 2; // seconds it takes
  const SPIN = "|/-\\";
  const EIGHTHS = "░▏▎▍▌▋▊▉";

  // Kernel lines: seconds since the previous line on the kernel's clock, then the text.
  const KERNEL = [
    [0, "kernel 6.8.0 starting on 8 cpus"],
    [0, "command line: root=/dev/sda2 ro quiet"],
    [0.004, "memory: 16384 MB available, 412 MB reserved"],
    [0.077, "smp: brought up 1 node, 8 cpus"],
    [0.082, "pci: probing bus 0000:00"],
    [0.047, "pci 0000:00:17.0: sata controller, 6 ports"],
    [0.087, "usb 1-1: new high speed device, number 2"],
    [0.022, "usb 1-4: new full speed device, number 3"],
    [0.084, "sd 0:0:0:0: [sda] 1000215216 sectors (512 GB)"],
    [0.002, " sda: sda1 sda2"],
    [0.107, "eth0: link up, 1000 Mb/s, full duplex"],
    [0.129, "ext4: mounted sda2 read-only"],
    [0.062, "init: running /sbin/init"],
  ];
  // Service lines: seconds after the previous line, then the text. A third value
  // makes it a start job that spins that long before it lands. The last is the login.
  const SERVICES = [
    [0.35, "[  OK  ] mounted root file system"],
    [0.12, "[  OK  ] started file system check on sda1"],
    [0.08, "[  OK  ] reached target local file systems"],
    [0.2, "[  OK  ] started journal service"],
    [0.1, "[  OK  ] started device manager"],
    [0.06, "[  OK  ] created runtime directories"],
    [0.15, "[  OK  ] started load kernel modules"],
    [0.25, "[ WARN ] clock not synced, using hardware time"],
    [0.2, "[  OK  ] started system logger"],
    [0.08, "[  OK  ] reached target sockets"],
    [0.1, "[  OK  ] reached target basic system"],
    [0.15, "[  OK  ] finished waiting for network", 2.6],
    [0.1, "[  OK  ] reached target network"],
    [0.25, "[  OK  ] synced clock to network time"],
    [0.1, "[  OK  ] started secure shell server"],
    [0.08, "[  OK  ] started job scheduler"],
    [0.1, "[  OK  ] started print spooler"],
    [0.3, "[  OK  ] reached target multi-user system"],
    [0.5, ""],
  ];
  const WAIT = 3.5; // seconds at the login prompt before the next boot

  function mulberry32(a) {
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function bootLog(analystLines) {
    const rows = 16;
    const rand = mulberry32(11);

    // Keep self-test rows compact so they can wrap inside the sidebar.
    const row = (label, detail, status = "") => [label, detail, status].filter(Boolean).join("  ");
    // A device probe spins until it resolves at `done`.
    const probe = (label, detail, status, done) => (now) =>
      now >= done ? row(label, detail, status) : row(label, "detecting " + SPIN[Math.floor((now + done) * 10) % 4]);
    const tested = (now) => Math.min(1, Math.max(0, (now - MEM_AT) / TEST));

    // Each entry: when it appears, and how it reads at a given moment.
    const entries = [];
    let at = 0;
    const put = (text) => entries.push({ at, text: typeof text === "string" ? () => text : text });

    at = 0.12; put(row("system firmware 2.31.0", "", "self test"));
    at += 0.04; put("─".repeat(28));
    at += 0.04; put(row("cpu", "4 cores, 8 threads at 2.40 GHz", "ok"));
    at += 0.04; put(row("cache", "l1 256 KB   l2 2 MB   l3 8 MB", "ok"));
    at += 0.04;
    put((now) => {
      const f = tested(now);
      const mb = Math.floor(f * MEMORY);
      return row("memory", String(mb).padStart(5) + " MB of " + MEMORY + " MB", f < 1 ? "testing" : "ok");
    });
    // The test's progress, the address it has reached, and a percentage.
    put((now) => {
      const f = tested(now);
      const fill = f * 12;
      const full = Math.floor(fill);
      const bar = ("█".repeat(full) + (full < 12 ? EIGHTHS[Math.floor((fill - full) * 8)] : "")).padEnd(12, "░");
      const top = MEMORY * 1048576;
      const addr = f < 1 ? Math.floor((f * top) / 4096) * 4096 : top - 1;
      const hex = "0x" + addr.toString(16).toUpperCase().padStart(9, "0");
      return bar + "  " + hex + "  " + Math.floor(f * 100) + "%";
    });
    at += 0.04; put(row("display", "1920 x 1080 at 60 Hz", "ok"));
    at += 0.04; put(probe("storage", "sata 0: disk 0, 512 GB", "ok", 1.3));
    at += 0.04; put(probe("usb", "2 controllers, 2 devices", "ok", 1.9));
    at += 0.04; put(probe("network", "1 port, 1000 Mb/s", "link up", 2.2));
    at += 0.04; put(probe("sensors", "cpu 41°C   board 33°C   fan 2400 rpm", "ok", 0.95));
    at += 0.04; put(row("boot order", "disk 0, usb, network"));
    at += 0.04; put("─".repeat(28));
    at += 0.04; put("F2 setup    F12 boot menu    esc skip memory test");
    at = MEM_AT + TEST + 0.2; put("");
    at += 0.05; put("booting from disk 0");
    at += 0.2; put("loading kernel 6.8.0 ...");

    // The kernel's burst plays at two thirds speed so it reads as a fast scroll.
    at += 0.3;
    let stamp = 0;
    for (const [gap, text] of KERNEL) {
      stamp += gap;
      at += gap * 1.5;
      const s = stamp ? stamp + rand() * 0.0009 : 0;
      put("[" + s.toFixed(6).padStart(12) + "] " + text);
    }

    const services = [...SERVICES, ...analystLines.map((text) => [0.22, text]), [0.5, "papershelf login: "]];
    for (const [gap, text, spin] of services) {
      at += gap;
      if (spin) {
        const from = at;
        put((now) => {
          const age = now - from;
          if (age >= spin) return text;
          // Three stars sweep back and forth inside the brackets. The job shows
          // itself once it has run for 5s, so its clock starts there.
          const k = Math.floor(age * 8) % 6;
          const p = k < 4 ? k : 6 - k;
          const stars = (" ".repeat(p) + "***").padEnd(6);
          return "[" + stars + "] a start job is running for network (" + Math.floor(age + 5) + "s / 1min 30s)";
        });
        at += spin;
      } else put(text);
    }
    const login = at;
    const period = login + WAIT;
    return (t) => {
      const now = t % period;
      const lines = [];
      for (const e of entries) if (e.at <= now) lines.push(e.text(now));
      // The cursor blinks after the login prompt, or at the top of the blank screen.
      if (now >= login) lines[lines.length - 1] += (now - login) % 1 < 0.6 ? "_" : "";
      else if (!lines.length) lines.push("_");
      return lines.slice(-rows).join("\n");
    };
  }

  const summary = document.querySelector(".boot-log-summary");
  const terminal = document.querySelector(".boot-log-terminal");
  const screen = terminal.querySelector(".boot-log-screen");
  const toggle = terminal.querySelector(".boot-log-toggle");
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const render = bootLog(Array.from(summary.children, (line) =>
    Array.from(line.children, (part) => part.textContent).join(" ")));

  let paused = false;
  let elapsed = 0;
  let startedAt = 0;
  let timer;

  function draw() {
    const frame = render((elapsed + performance.now() - startedAt) / 1000);
    if (screen.textContent !== frame) {
      screen.textContent = frame;
      screen.scrollTop = screen.scrollHeight;
    }
  }

  function syncPlayback() {
    terminal.hidden = motion.matches;
    summary.classList.toggle("sr-only", !motion.matches);
    toggle.textContent = paused ? "Resume boot log" : "Pause boot log";

    const shouldPlay = !paused && !motion.matches && !document.hidden;
    if (shouldPlay && timer === undefined) {
      startedAt = performance.now();
      draw();
      timer = setInterval(draw, 1000 / 15);
    } else if (!shouldPlay && timer !== undefined) {
      elapsed += performance.now() - startedAt;
      clearInterval(timer);
      timer = undefined;
    }
  }

  toggle.addEventListener("click", () => {
    paused = !paused;
    syncPlayback();
  });
  motion.addEventListener("change", syncPlayback);
  document.addEventListener("visibilitychange", syncPlayback);
  syncPlayback();
})();
