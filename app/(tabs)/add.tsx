import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { categories } from '../../src/constants/categories';
import { AppText, common, Gradient, Icon, Screen } from '../../src/components/ui';
import { theme } from '../../src/constants/theme';
const supported=['calendar','special-days','lists','notebook','partner-note','letters','song','mood','gifts','info','places','documents'];
export default function AddScreen(){return <Screen><View style={{gap:9,marginTop:8,marginBottom:26}}><AppText style={common.overline}>BİRLİKTE BİR ŞEY EKLEYİN</AppText><AppText style={common.title}>Küçük bir başlangıç.</AppText><AppText style={common.subtitle}>Bir plan, bir not, belki de günün şarkısı.</AppText></View><View style={{gap:10}}>{categories.filter(c=>supported.includes(c.id)).map(c=><Pressable key={c.id} accessibilityRole="button" onPress={()=>router.push({pathname:'/category/[id]',params:{id:c.id,create:'1'}})} style={({pressed})=>[s.item,{opacity:pressed?.65:1}]}><Gradient colors={c.colors} style={s.icon}><Icon name={c.icon} size={23} color={c.ink}/></Gradient><View style={{flex:1,gap:4}}><AppText style={s.title}>{c.id==='documents'?'Bağlantı ekle':c.name}</AppText><AppText style={s.description}>{c.description}</AppText></View><Icon name="Plus" size={19} color={theme.brand}/></Pressable>)}</View></Screen>;}
const s=StyleSheet.create({item:{flexDirection:'row',alignItems:'center',padding:15,borderRadius:19,gap:14,backgroundColor:theme.surface,borderWidth:1,borderColor:theme.border},icon:{width:47,height:47,borderRadius:17,alignItems:'center',justifyContent:'center'},title:{fontFamily:theme.bold,fontSize:14},description:{fontSize:11,color:theme.muted,lineHeight:17}});
