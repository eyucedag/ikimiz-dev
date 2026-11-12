import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold } from '@expo-google-fonts/manrope';
import { AuthProvider } from '../src/hooks/useAuth';
import { AppProvider } from '../src/hooks/useApp';
import { theme } from '../src/constants/theme';
import { IncomingKiss } from '../src/components/IncomingKiss';

export default function RootLayout() {
  const [loaded,error]=useFonts({Manrope_400Regular,Manrope_500Medium,Manrope_600SemiBold,Manrope_700Bold,Manrope_800ExtraBold});
  if(!loaded&&!error) return <View style={{flex:1,alignItems:'center',justifyContent:'center',backgroundColor:theme.background}}><ActivityIndicator color={theme.brand}/></View>;
  return <SafeAreaProvider><AuthProvider><AppProvider><StatusBar style="dark"/><Stack screenOptions={{headerShown:false,contentStyle:{backgroundColor:theme.background},animation:'slide_from_right'}}><Stack.Screen name="(tabs)"/><Stack.Screen name="category/[id]"/><Stack.Screen name="auth" options={{presentation:'modal'}}/><Stack.Screen name="customize"/></Stack><IncomingKiss/></AppProvider></AuthProvider></SafeAreaProvider>;
}
