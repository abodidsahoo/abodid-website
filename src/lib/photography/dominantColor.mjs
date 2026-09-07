// Select a populated, colorful region, preserving an actual sampled pixel.
// No warm-hue bonus, forced saturation, or whole-image average.
export function dominantColor(data) {
  const bins = new Map();
  for (let i=0;i<data.length;i+=4) {
    if (data[i+3]<128) continue;
    const rgb=[data[i],data[i+1],data[i+2]];
    const max=Math.max(...rgb), min=Math.min(...rgb);
    const chroma=(max-min)/255;
    const key=rgb.map(v=>v>>4).join(',');
    const bin=bins.get(key)||{count:0,rgb,chroma};
    bin.count++; bins.set(key,bin);
  }
  const all=[...bins.values()];
  if (!all.length) return {bg:'#fbfbf9',isDark:false,textColor:'#141414',subtextColor:'#494949'};
  const biggest=Math.max(...all.map(b=>b.count));
  const colorful=all.filter(b=>b.count>=Math.max(2,biggest*.12)&&b.chroma>.15);
  const pool=colorful.length?colorful:all;
  const selected=pool.reduce((a,b)=>b.count*(.6+b.chroma)>a.count*(.6+a.chroma)?b:a);
  const rgb=selected.rgb;
  const linear=rgb.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});
  const luminance=.2126*linear[0]+.7152*linear[1]+.0722*linear[2];
  const isDark=(1.05/(luminance+.05))>((luminance+.05)/.05);
  return {bg:`rgb(${rgb.join(',')})`,isDark,textColor:isDark?'#ffffff':'#000000',subtextColor:isDark?'#ffffff':'#000000'};
}
