const Q = ['左門町 新宿区','鈴ヶ森刑場跡','鈴が森 刑場','鷲神社 千束','大黒湯 足立区','洲崎球場跡 江東区','神田明神通り','防衛省 市谷','千駄ヶ谷 トンネル','穴守稲荷 大鳥居','東京ステーションホテル','旧博物館動物園駅 上野公園','秋葉原 ラジオセンター','スーパーポテト','東京都慰霊堂','六本木ヒルズ','荒川区 南千住 山谷','山谷 清川','ボートレース平和島','平和島駅','池袋 友誼食府','高田馬場 ゲームセンターミカド','ミカド 高田馬場','洲崎パラダイス','有楽町駅','新橋駅 銀座線'];
for (const q of Q) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=2&countrycodes=jp&viewbox=139.2,35.9,140.0,35.4&bounded=1`;
  try { const j = await (await fetch(url,{headers:{'User-Agent':'tokio-2026-guide/1.0'}})).json();
    console.log(q, '→', j.map(x=>`${(+x.lat).toFixed(4)},${(+x.lon).toFixed(4)} ${x.display_name.slice(0,30)}`).join(' | ') || 'brak'); } catch(e){ console.log(q,'błąd'); }
  await new Promise(r=>setTimeout(r,1100));
}
