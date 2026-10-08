/* Shared quotation arithmetic for the PC and mini-program demos. */
(() => {
  'use strict';
  const round = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
  const permission = Object.freeze({mode:'percent',value:2,cap:20000});
  function floorPrice(price, weightKg, rule=permission) {
    return round(Math.max(0, rule.mode==='fixed' ? price-rule.value*weightKg/1000 : price*(1-rule.value/100)));
  }
  function supply({tons,stockTons=0,mode='auto',shippingDays=3,productionDays=5}) {
    if(!Number.isFinite(tons)||tons<=0)return {days:null,label:'交期待确认',error:'请填写有效数量。'};
    const shortage=Math.max(0,tons-stockTons);
    const stage=shortage<1e-8?'spot':['missing','spot'].includes(mode)?mode:'production';
    if(stage==='missing')return {days:null,label:'交期待确认',shortage,detail:'交期参数待补充，具体交期由业务后续确认。'};
    if(stage==='spot'&&shortage>1e-8)return {days:null,label:'交期待确认',shortage,detail:'现货不足，补货方式及交期由业务后续确认。'};
    const cycles=stage==='spot'?[shippingDays]:[productionDays,shippingDays];
    if(cycles.some(n=>!Number.isFinite(n)||n<0))return {days:null,label:'交期待确认',shortage,detail:'交期参数待补充，具体交期由业务后续确认。'};
    const days=cycles.reduce((a,b)=>a+b,0),label=stage==='spot'?'现货':'生产补足';
    return {days,label,shortage,detail:stage==='spot'?`发运 ${shippingDays} 天`:`生产 ${productionDays} 天 + 发运 ${shippingDays} 天`};
  }
  const products = [
    {id:'oem-hm68',code:'OEM-HM68',type:'oem',name:'抗磨液压油 L-HM 68',description:'高清高压 · 白色 · 马石油',category:'industrial',spec:'20L / 16kg',weightKg:16,price:175.04,cost:165,stockTons:10,qty:20},
    {id:'oem-hm46',code:'OEM-HM46',type:'oem',name:'抗磨液压油 L-HM 46',description:'高清高压 · 白色 · 马石油',category:'industrial',spec:'20L / 16kg',weightKg:16,price:171.21,cost:160,stockTons:0,qty:20},
    {id:'brand-hm46',code:'TY-HM46-170',type:'brand',name:'腾原智造 抗磨液压油 L-HM 46',description:'高压 · 淡黄色 · 蓝盖蓝黄蓝桶',category:'industrial',spec:'170kg / 桶',weightKg:170,price:1910,cost:1820,stockTons:11.56,qty:10},
    {id:'brand-dah46',code:'TY-DAH46-170',type:'brand',name:'腾原智造 空气压缩机油 L-DAH 46',description:'优选·经典 · 淡黄色 · 浅蓝桶',category:'industrial',spec:'170kg / 桶',weightKg:170,price:1980,cost:1890,stockTons:0,qty:10}
  ].map(p=>Object.freeze({...p,floor:floorPrice(p.price,p.weightKg),pricePerTon:round(p.price*1000/p.weightKg)}));
  function evaluate({lines=[],coupon=0,delivery='pickup',address='',rule=permission}) {
    const errors=[];
    if(!lines.length)errors.push('请先选择商品。');
    const rows=lines.map((p,index)=>{
      const qty=Number(p.qty),quote=Number(p.quote),weightKg=Number(p.weightKg),price=Number(p.price),floor=p.floor??floorPrice(price,weightKg,rule);
      const validQty=Number.isFinite(qty)&&qty>0&&qty<=1000000&&(p.unit==='吨'||Number.isInteger(qty));
      const validQuote=Number.isFinite(quote)&&quote>0&&quote<=100000000&&Math.abs(quote*100-Math.round(quote*100))<1e-6;
      const packagingPrice=Number(p.packagingPrice??0),validPackaging=Number.isFinite(packagingPrice)&&packagingPrice>=0&&packagingPrice<=100000000&&Math.abs(packagingPrice*100-Math.round(packagingPrice*100))<1e-6&&(!p.packagingRequired||(p.packagingPrice!==''&&p.packagingPrice!=null));
      let error='';
      if(!Number.isFinite(weightKg)||weightKg<=0||weightKg>1000||!Number.isFinite(price)||price<=0)error='请填写有效的包装净重。';
      else if(!validQty)error=p.unit==='吨'?'数量须大于 0。':'桶数须为大于 0 的整数。';
      else if(!validQuote)error='请填写有效报价。';
      else if(quote<floor-1e-8)error=`报价低于最低可报 ¥${floor.toFixed(2)}/${p.unit||'桶'}。`;
      if(!error&&!validPackaging)error='请填写有效包材单价。';
      const tons=validQty?qty*weightKg/1000:0;
      const eta=supply({tons,stockTons:p.stockTons,mode:p.supplyMode||'auto',shippingDays:p.shippingDays===undefined?3:p.shippingDays,productionDays:p.productionDays===undefined?5:p.productionDays});
      if(!error&&eta.error)error=eta.error;
      if(error)errors.push(`${p.name||`商品 ${index+1}`}：${error}`);
      return {...p,packagingPrice:validPackaging?packagingPrice:0,qty,quote,floor,tons,eta,error,amount:validQty&&validQuote?round(qty*quote):0,listAmount:validQty?round(qty*price):0,packagingAmount:validQty&&validPackaging?round(qty*packagingPrice):0,commission:round(Number(p.commission)||0)};
    });
    const sum=key=>round(rows.reduce((total,p)=>total+(p[key]||0),0));
    const productTotal=sum('amount'),listTotal=sum('listAmount'),packagingTotal=sum('packagingAmount'),tons=rows.reduce((n,p)=>n+p.tons,0);
    const salesDiscount=round(rows.reduce((n,p)=>n+Math.max(0,p.listAmount-p.amount),0));
    if(rule.cap!=null&&salesDiscount>rule.cap+.001)errors.push(`销售让利总额超过单笔上限 ¥${rule.cap.toFixed(2)}。`);
    const couponDisabled=rows.some(p=>p.quote>p.price+.001);
    const freight=delivery==='delivery'&&address?round(tons*60):0;
    if(delivery==='delivery'&&!address)errors.push('请选择配送地址，以匹配运费。');
    const base=round(productTotal+packagingTotal+freight);
    const appliedCoupon=couponDisabled?0:Math.min(Math.max(0,Number(coupon)||0),base);
    const maxEta=rows.some(p=>p.eta.days===null)?null:Math.max(0,...rows.map(p=>p.eta.days));
    return {rows,errors,valid:errors.length===0,productTotal,listTotal,packagingTotal,tons,salesDiscount,couponDisabled,coupon:round(appliedCoupon),freight,payable:round(base-appliedCoupon),maxEta,belowCostAfterCoupon:appliedCoupon>0&&productTotal-appliedCoupon<rows.reduce((n,p)=>n+(p.cost||0)*p.qty,0)};
  }
  window.SalesQuoteCore=Object.freeze({round,permission,products:Object.freeze(products),floorPrice,supply,evaluate});
})();
