import React, { useEffect, useState } from 'react';
import { Animated, Modal, StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useApp } from '../hooks/useApp';
import type { AppNotification } from '../types';
import { AppText, Button } from './ui';
import { theme } from '../constants/theme';

export function IncomingKiss(){
  const {mode,userId}=useApp();
  return mode==='cloud'?<KissInbox key={userId} userId={userId}/>:null;
}
function KissInbox({userId}:{userId:string}){
  const {notifications,ready,profile}=useApp();
  const [seen,setSeen]=useState<string[]|null>(null);
  const [active,setActive]=useState<AppNotification|null>(null);
  const [scale]=useState(()=>new Animated.Value(.7));
  const storageKey=`ikimiz:seen-kisses:${userId}`;
  const candidate=ready&&seen!==null&&!active?notifications.find(n=>n.kind==='kiss'&&!n.read&&!seen.includes(n.id)):undefined;
  useEffect(()=>{
    let live=true;
    void AsyncStorage.getItem(storageKey).then(raw=>{
      const parsed:unknown=raw?JSON.parse(raw):[];
      if(live)setSeen(Array.isArray(parsed)?parsed.filter((id):id is string=>typeof id==='string'):[]);
    }).catch(()=>{ /* The notification inbox remains available if device storage fails. */ });
    return()=>{live=false;};
  },[storageKey]);
  useEffect(()=>{
    if(!candidate||seen===null)return;
    let live=true;
    const next=[...seen,candidate.id];
    // Claim the animation before opening it, so app restarts do not replay it.
    void AsyncStorage.setItem(storageKey,JSON.stringify(next)).then(()=>{
      if(live){setSeen(next);setActive(candidate);}
    }).catch(()=>{ /* Keep the original notification for the user to read. */ });
    return()=>{live=false;};
  },[candidate,seen,storageKey]);
  useEffect(()=>{
    if(!active)return;
    scale.setValue(.7);
    Animated.spring(scale,{toValue:1,friction:4,tension:60,useNativeDriver:true}).start();
    return()=>scale.stopAnimation();
  },[active,scale]);
  return <Modal transparent visible={!!active} animationType="fade" onRequestClose={()=>setActive(null)}><View style={styles.backdrop}><Animated.View style={{transform:[{scale}],alignItems:'center'}}><AppText style={styles.emoji}>💋</AppText><AppText style={styles.title}>{profile.partnerName||'Partnerin'} sana bir öpücük bıraktı.</AppText><AppText style={styles.body}>Günün biraz daha güzel olsun.</AppText></Animated.View><Button label="Gülümseyerek devam et" secondary color="#FFFFFF" onPress={()=>setActive(null)} style={{marginTop:30}}/></View></Modal>;
}
const styles=StyleSheet.create({backdrop:{flex:1,backgroundColor:'#685567F5',alignItems:'center',justifyContent:'center',padding:30},emoji:{fontSize:95,marginBottom:22},title:{fontFamily:theme.bold,fontSize:24,lineHeight:34,textAlign:'center',maxWidth:330,color:'#FFFFFF'},body:{fontSize:13,marginTop:14,color:'#E9DCE2',textAlign:'center'}});
