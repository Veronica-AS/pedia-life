import{d as l,a as f,r as h,j as e}from"./index-BQ87swCM.js";import{f as x,D as N,d as p,m as k}from"./download-Dz7EsSRT.js";/**
 * @license lucide-react v0.460.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const g=l("CircleCheck",[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"m9 12 2 2 4-4",key:"dzmm74"}]]);/**
 * @license lucide-react v0.460.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const C=l("RotateCcw",[["path",{d:"M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8",key:"1357e3"}],["path",{d:"M3 3v5h5",key:"1xhq8a"}]]);/**
 * @license lucide-react v0.460.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const v=l("Undo2",[["path",{d:"M9 14 4 9l5-5",key:"102s5s"}],["path",{d:"M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11",key:"f3b9sd"}]]);function M({files:a,zipName:n,children:d,onBack:c,onReset:u,note:r}){const{t:s,lang:o}=f(),i=h.useRef(null);h.useEffect(()=>{i.current?.focus()},[]);const m=a.reduce((j,w)=>j+w.bytes.length,0),t=a.length===1,y=t&&a[0].type==="application/pdf",b=()=>{t?p(new Blob([a[0].bytes],{type:a[0].type}),a[0].name):p(new Blob([k(a)],{type:"application/zip"}),n)};return e.jsxs("section",{className:"space-y-4","aria-labelledby":"result-title",children:[e.jsxs("div",{className:"card p-4 sm:p-5",children:[e.jsxs("div",{className:"flex items-start gap-3",children:[e.jsx(g,{className:"mt-0.5 h-6 w-6 shrink-0 text-emerald-600 dark:text-emerald-400","aria-hidden":"true"}),e.jsxs("div",{className:"min-w-0 flex-1",children:[e.jsx("h2",{id:"result-title",ref:i,tabIndex:-1,className:"text-lg font-bold",children:s("resultReady")}),e.jsx("p",{className:"mt-1 break-all text-sm muted","data-testid":"result-summary",children:t?s("resultSummary",{name:a[0].name,size:x(m,o)}):s("resultSummary",{name:n,size:x(m,o)})})]})]}),r&&e.jsx("div",{className:"mt-3",children:r}),e.jsxs("div",{className:"mt-4 flex flex-col gap-2 sm:flex-row",children:[e.jsxs("button",{type:"button",className:"btn-primary flex-1 py-3 text-base sm:flex-none sm:px-8",onClick:b,"data-testid":"download",children:[e.jsx(N,{className:"h-5 w-5","aria-hidden":"true"}),t?s(y?"downloadPdf":"download"):s("downloadZip",{n:a.length})]}),c&&e.jsxs("button",{type:"button",className:"btn-secondary",onClick:c,children:[e.jsx(v,{className:"h-4 w-4","aria-hidden":"true"}),s("backToEdit")]}),e.jsxs("button",{type:"button",className:"btn-ghost",onClick:u,children:[e.jsx(C,{className:"h-4 w-4","aria-hidden":"true"}),s("startOver")]})]})]}),d&&e.jsxs("div",{className:"card p-4 sm:p-5",children:[e.jsx("h3",{className:"mb-3 font-semibold",children:s("previewTitle")}),d]})]})}export{g as C,M as R,v as U,C as a};
