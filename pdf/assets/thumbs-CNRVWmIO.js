import{d as f}from"./index-BQ87swCM.js";import{r as g,c as p,b as u}from"./ProgressBar-CQod_vNl.js";/**
 * @license lucide-react v0.460.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const C=f("ChevronLeft",[["path",{d:"m15 18-6-6 6-6",key:"1wnfg3"}]]),m=2;let i=0;const o=[];async function v(e){i>=m&&await new Promise(a=>o.push(a)),i++;try{return await e()}finally{i--,o.shift()?.()}}function L(e,a,r,s="image/jpeg"){return v(async()=>{const n=await e.getPage(a),c=n.getViewport({scale:1}),w=Math.min(2,typeof window<"u"&&window.devicePixelRatio||1),h=r*w/Math.max(c.width,1),{canvas:t}=await g(n,h),d=await p(t,s,.85),l={url:URL.createObjectURL(d),width:t.width,height:t.height};return u(t),n.cleanup(),l})}export{C,L as r};
