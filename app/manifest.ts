import type { MetadataRoute } from 'next';
export default function manifest(): MetadataRoute.Manifest {return {name:'Floralhelp',short_name:'Floralhelp',start_url:'/',id:'/',display:'standalone',background_color:'#fffaf7',theme_color:'#fce6ef',icons:[{src:'/apple-touch-icon.png',sizes:'180x180',type:'image/png'},{src:'/floralhelp-icon.svg',sizes:'any',type:'image/svg+xml'}]};}
