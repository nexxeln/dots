"use strict";var i=Object.defineProperty;var f=Object.getOwnPropertyDescriptor;var p=Object.getOwnPropertyNames;var o=Object.prototype.hasOwnProperty;var h=(e,a)=>{for(var n in a)i(e,n,{get:a[n],enumerable:!0})},g=(e,a,n,s)=>{if(a&&typeof a=="object"||typeof a=="function")for(let r of p(a))!o.call(e,r)&&r!==n&&i(e,r,{get:()=>a[r],enumerable:!(s=f(a,r))||s.enumerable});return e};var m=e=>g(i({},"__esModule",{value:!0}),e);var S={};h(S,{default:()=>d});module.exports=m(S);var t=require("@raycast/api");var l=[{Appearance:"enhancer_sealgold.png",Name:"Gold Seal",Effect:"Earn $3 when this card is played and scores"},{Appearance:"enhancer_sealred.png",Name:"Red Seal",Effect:"Retrigger this card 1 time"},{Appearance:"enhancer_sealblue.png",Name:"Blue Seal",Effect:"Creates a Planet card if this card is held in hand at end of round"},{Appearance:"enhancer_sealpurple.png",Name:"Purple Seal",Effect:"Creates a Tarot card when discarded. Must have room"}];var c=require("react/jsx-runtime");function d(){return(0,c.jsx)(t.List,{isLoading:!0,isShowingDetail:!0,navigationTitle:"Seals",searchBarPlaceholder:"Searching by Seal's name...",children:l.map((e,a)=>(0,c.jsx)(t.List.Item,{title:e.Name,subtitle:e.Effect,detail:(0,c.jsx)(t.List.Item.Detail,{markdown:E(e)})},a))})}function E(e){return`
# ${e.Name}

 ![](seals/${e.Appearance}?raycast-width=122&raycast-height=164)

## Effect
${e.Effect}
`}
