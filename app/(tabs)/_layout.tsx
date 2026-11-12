import React from 'react';
import { Tabs } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../src/components/ui';
import { theme } from '../../src/constants/theme';
import { useApp } from '../../src/hooks/useApp';

export default function TabLayout() {
 const insets=useSafeAreaInsets(); const {notifications}=useApp(); const unread=notifications.filter(n=>!n.read).length;
 return <View style={{flex:1,backgroundColor:theme.background}}><Tabs screenOptions={{headerShown:false,tabBarActiveTintColor:theme.brand,tabBarInactiveTintColor:theme.muted,tabBarStyle:{backgroundColor:'#FAFBFC',borderTopColor:theme.border,height:78+insets.bottom,paddingTop:10,paddingBottom:Math.max(insets.bottom,12),elevation:0},tabBarLabelStyle:{fontFamily:theme.semibold,fontSize:10,marginTop:4},sceneStyle:{backgroundColor:theme.background}}}>
   <Tabs.Screen name="index" options={{title:'Bugün',tabBarIcon:({color})=><Icon name="House" color={typeof color==='string'?color:theme.brand} size={23}/>}}/>
   <Tabs.Screen name="categories" options={{title:'Kategoriler',tabBarIcon:({color})=><Icon name="LayoutGrid" color={typeof color==='string'?color:theme.brand} size={23}/>}}/>
   <Tabs.Screen name="add" options={{title:'Takvim',tabBarIcon:({color})=><View style={{width:49,height:49,borderRadius:19,backgroundColor:theme.brand,alignItems:'center',justifyContent:'center',marginTop:8}}><Icon name="CalendarDays" color="#FFFFFF" size={25}/></View>}}/>
   <Tabs.Screen name="notifications" options={{title:'Bildirimler',tabBarBadge:unread||undefined,tabBarBadgeStyle:{backgroundColor:'#93485F',fontSize:10},tabBarIcon:({color})=><Icon name="Bell" color={typeof color==='string'?color:theme.brand} size={23}/>}}/>
   <Tabs.Screen name="settings" options={{title:'Ayarlar',tabBarIcon:({color})=><Icon name="Settings2" color={typeof color==='string'?color:theme.brand} size={23}/>}}/>
 </Tabs></View>;
}
