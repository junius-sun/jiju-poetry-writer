// Original vector motifs, independent of the historical floral scans.
export function collectionArtwork(style,p,w,h,direction,bodyBottom) {
  if(style==='porcelain') {
    const scroll=Array.from({length:Math.ceil((w-100)/65)},(_,i)=>`<path d="M${50+i*65} ${h-67}q16-24 32 0t32 0m-48-3q10-14 18 0"/>`).join('');
    const corner=`<g fill="none" stroke="${p.ink}" stroke-width="1.5" opacity=".65"><path d="M0 68V0H72M9 55V9H58M20 39q18-36 36-17q-24-1-25 18q22-16 31 2q-25 9-28-8M19 65q26-9 24-33"/><circle cx="22" cy="26" r="4"/></g>`;
    return `<rect x="27" y="64" width="${w-54}" height="${h-113}" fill="none" stroke="${p.ink}" stroke-opacity=".45"/><rect x="34" y="71" width="${w-68}" height="${h-127}" fill="none" stroke="${p.ink}" stroke-width=".5" stroke-opacity=".35"/><g transform="translate(43 81)">${corner}</g><g transform="translate(${w-43} 81) scale(-1 1)">${corner}</g><g fill="none" stroke="${p.ink}" stroke-opacity=".24">${scroll}</g>`;
  }
  const y=direction==='vertical'?h-470:bodyBottom+30;
  const scale=direction==='vertical'?1:Math.max(.3,Math.min(.55,(h-y-55)/360));
  if(style==='bamboo') {
    const leaves=[[66,83,-35],[89,127,20],[54,159,-63],[120,191,14],[44,224,-40],[110,253,-10],[76,292,28]].map(([x,ly,a])=>`<g transform="translate(${x} ${ly}) rotate(${a})"><path d="M0 0Q-15-27-48-34Q-35-6 0 0M0 0Q10-32 44-42Q33-11 0 0M0 0Q-9-13-34-8Q-19 6 0 0" fill="${p.mountain}" opacity=".72"/></g>`).join('');
    return `<g transform="translate(29 ${y}) scale(${scale})"><path d="M31 366Q56 182 83 4M87 370Q102 218 136 93" stroke="${p.mountain}" stroke-width="5" opacity=".65" fill="none"/><path d="m45 284 14 1m-4-72 13 2m0-70 13 2m27 139 14 2m-3-69 13 2" stroke="${p.paper}" stroke-width="3"/>${leaves}<g transform="translate(126 330)"><path d="M-9 0q13-19 26-3q-3 21-25 13l-17 12 8-18Z" fill="${p.ink}" opacity=".7"/><path d="m14-10 11 5-10 1m-10 15-2 14m-6-14-2 14" stroke="${p.ink}" fill="none"/><circle cx="11" cy="-4" r="1.5" fill="${p.paper}"/></g></g>`;
  }
  if(style==='plum') {
    const flowers=[[27,253],[75,207],[125,157],[79,116],[155,91],[110,49],[47,178],[150,227]].map(([x,by],i)=>`<g transform="translate(${x} ${by}) rotate(${i*17})">${[0,72,144,216,288].map(a=>`<ellipse cx="0" cy="-7" rx="6" ry="8" transform="rotate(${a})" fill="${p.seal}" opacity="${.35+i%3*.15}"/>`).join('')}<circle r="3" fill="${p.gold}"/><circle r="1" fill="${p.ink}"/></g>`).join('');
    return `<g transform="translate(22 ${y}) scale(${scale})"><path d="M5 369Q29 277 68 208T154 80M50 241Q30 187 42 151M90 174Q75 111 110 40M116 145Q155 148 181 120M69 208Q119 232 165 221" stroke="${p.ink}" opacity=".65" stroke-width="4" stroke-linecap="round" fill="none"/><path d="M8 364Q35 269 71 210" stroke="${p.gold}" stroke-width="1.5" opacity=".55" fill="none"/>${flowers}</g>`;
  }
  return '';
}
