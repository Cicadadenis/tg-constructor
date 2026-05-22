#!/usr/bin/env node
/** Restore emoji/icons corrupted by a bad mojibake script (2Z, 2Y, @_ …). */
import fs from 'fs';
import path from 'path';

const file = path.resolve('src/App.jsx');
let s = fs.readFileSync(file, 'utf8');

const pairs = [
  ['>{builderUi.examplesOpen}</button>', null], // placeholder — applied below
  ['>2Y<span style={{ opacity: 0.55, fontSize: 9, lineHeight: 1 }}>2X</span></button>', '>{builderUi.examplesOpen}</button>'],
  ['>2Y <span style={{ opacity: 0.5, fontSize: 10 }}>2X</span></button>', '>{builderUi.examplesOpen}</button>'],
  [">{canUseAiGenerator ? '2Z AI' : '@_ AI'}</button>", ">{canUseAiGenerator ? '✨ AI' : '🔒 AI'}</button>"],
  ['>2Z\\"</button>', '>✕</button>'],
  ['>@_ <span style={{ opacity: 0.5, fontSize: 10 }}>2X</span></button>', '>📁 <span style={{ opacity: 0.5, fontSize: 10 }}>▼</span></button>'],
  [">{canUseAiGenerator ? 'AI' : '@_'}</button>", ">{canUseAiGenerator ? 'AI' : '🔒'}</button>"],
  ['>@_</button>', '>📖</button>'],
  ['<span style={{ color: \'#4ade80\' }}>2Y</span>', '<span style={{ color: \'#4ade80\' }}>⚡</span>'],
  ['<span style={{ color: \'#3ecf8e\' }}>@_U</span>', '<span style={{ color: \'#3ecf8e\' }}>💾</span>'],
  ['<span style={{ color: \'#60a5fa\' }}>@_</span>', '<span style={{ color: \'#60a5fa\' }}>📂</span>'],
  ['>2Z\\" {builderUi.clearCanvas}</button>', '>✕ {builderUi.clearCanvas}</button>'],
  ['>@_U {currentUser ? builderUi.saveCloud : builderUi.saveFile}</button>', '>💾 {currentUser ? builderUi.saveCloud : builderUi.saveFile}</button>'],
  ["}}><span style={{ color:'#06b6d4', fontSize:11 }}>2Z</span>", "}}><span style={{ color:'#06b6d4', fontSize:11 }}>✏️</span>"],
  ['<span className="lp-cross">2Z</span>', '<span className="lp-cross">✗</span>'],
  [">{toast.type === 'error' ? '⚠️' : toast.type === 'success' ? '2Z&' : 'ℹ️'}", ">{toast.type === 'error' ? '⚠️' : toast.type === 'success' ? '✅' : 'ℹ️'}"],
  [">{isMobileView ? '  U ! Q' : '  U ! Q'}</button>", ">Войти</button>"],
  ['      )}\\n\n      {showExamples', '      )}\n      {showExamples'],
  ['      )}\\n      {showExamples', '      )}\n      {showExamples'],
  [
    `            >
              @_
            </button>`,
    `            >
              📎
            </button>`,
  ],
];

let n = 0;
for (const [from, to] of pairs) {
  if (!from || !to) continue;
  if (s.includes(from)) {
    s = s.split(from).join(to);
    n++;
  }
}
fs.writeFileSync(file, s, 'utf8');
console.log(`fixed ${n} patterns in App.jsx`);
