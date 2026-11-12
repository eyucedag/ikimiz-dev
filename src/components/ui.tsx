import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextProps, type TextInputProps, type ViewStyle, type StyleProp } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ArrowUpRight, Bell, BookOpen, CalendarClock, CalendarDays, Camera, Check, CheckCheck, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Circle, CircleAlert, CircleCheck, CircleHelp, Clock3, Cloud, Copy, Download, Droplets, Ellipsis, ExternalLink, Eye, EyeOff, FileText, Footprints, Gift, Heart, House, Images, Info, KeyRound, LayoutGrid, Link, ListChecks, LoaderCircle, LockKeyhole, LogOut, Mail, Map, MapPin, MessageSquareHeart, Mic, Music2, Navigation, NotebookPen, Palette, Pencil, Play, Plus, RefreshCw, Repeat2, Search, Send, Settings2, Share2, ShieldCheck, SlidersHorizontal, Smile, Sparkles, Sprout, Trash2, Unlink, Upload, User, UserRound, Users, Volume2, WifiOff, X, type LucideIcon } from 'lucide-react-native';
import { theme } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const iconMap: Record<string,LucideIcon> = {ArrowDown,ArrowLeft,ArrowRight,ArrowUp,ArrowUpRight,Bell,BookOpen,CalendarClock,CalendarDays,Camera,Check,CheckCheck,ChevronDown,ChevronLeft,ChevronRight,ChevronUp,Circle,CircleAlert,CircleCheck,CircleHelp,Clock3,Cloud,Copy,Download,Droplets,Ellipsis,ExternalLink,Eye,EyeOff,FileText,Footprints,Gift,Heart,House,Images,Info,KeyRound,LayoutGrid,Link,ListChecks,LoaderCircle,LockKeyhole,LogOut,Mail,Map,MapPin,MessageSquareHeart,Mic,Music2,Navigation,NotebookPen,Palette,Pencil,Play,Plus,RefreshCw,Repeat2,Search,Send,Settings2,Share2,ShieldCheck,SlidersHorizontal,Smile,Sparkles,Sprout,Trash2,Unlink,Upload,User,UserRound,Users,Volume2,WifiOff,X};
export function Icon({name,size=22,color=theme.text,strokeWidth=1.8}:{name:string;size?:number;color?:string;strokeWidth?:number}) { const Component=iconMap[name]??Heart; return <Component size={size} color={color} strokeWidth={strokeWidth}/>; }
export function AppText({style,...props}:TextProps) { return <Text {...props} style={[styles.text,style]}/>; }
export function Gradient({colors,children,style}:{colors:readonly [string,string,...string[]];children?:React.ReactNode;style?:StyleProp<ViewStyle>}) { return <LinearGradient colors={colors} start={{x:0,y:0}} end={{x:1,y:1}} style={style}>{children}</LinearGradient>; }
function buttonInk(color:string):string {
  if(!/^#[0-9a-f]{6}$/i.test(color))return theme.white;
  const channels=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
  const luminance=channels[0]*.2126+channels[1]*.7152+channels[2]*.0722;
  return 1.05/(luminance+.05)>=4.5?theme.white:theme.text;
}
export function Button({label,onPress,icon,color=theme.brand,secondary=false,disabled=false,loading=false,style}:{label:string;onPress:()=>void;icon?:string;color?:string;secondary?:boolean;disabled?:boolean;loading?:boolean;style?:StyleProp<ViewStyle>}) {
  const ink=secondary?color:buttonInk(color);
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled||loading} onPress={onPress} style={({pressed})=>[styles.button,{backgroundColor:secondary?'transparent':color,borderColor:secondary?theme.border:color,borderWidth:1,opacity:disabled?.45:pressed?.75:1},style]}>{loading?<ActivityIndicator color={ink}/>:icon?<Icon name={icon} size={18} color={ink}/>:null}<AppText style={{fontFamily:theme.bold,fontSize:14,color:ink}}>{label}</AppText></Pressable>;
}
export function Field({label,style,...props}:TextInputProps&{label:string}) { return <View style={styles.fieldWrap}><AppText style={styles.label}>{label}</AppText><TextInput placeholderTextColor={theme.muted} accessibilityLabel={label} {...props} style={[styles.input,props.multiline&&{height:108,textAlignVertical:'top',paddingTop:14},style]}/></View>; }
export function Screen({children,style}:{children:React.ReactNode;style?:StyleProp<ViewStyle>}) { const insets=useSafeAreaInsets(); return <ScrollView style={styles.screen} contentContainerStyle={[styles.screenContent,{paddingTop:16+insets.top,paddingBottom:24+insets.bottom},style]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>{children}</ScrollView>; }
export function EmptyState({icon,title,body,action}:{icon:string;title:string;body:string;action?:React.ReactNode}) {return <View style={styles.empty}><View style={styles.emptyIcon}><Icon name={icon} size={28} color={theme.brand}/></View><AppText style={styles.emptyTitle}>{title}</AppText><AppText style={styles.emptyBody}>{body}</AppText>{action}</View>;}
export const common = StyleSheet.create({
  row:{flexDirection:'row',alignItems:'center',gap:10}, between:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12},
  title:{fontFamily:theme.extrabold,fontSize:30,letterSpacing:-1,color:theme.text}, subtitle:{fontSize:14,color:theme.muted,lineHeight:23},
  card:{backgroundColor:theme.surface,borderRadius:22,borderWidth:1,borderColor:theme.border,padding:20},
  overline:{fontSize:10,fontFamily:theme.bold,letterSpacing:1.8,color:theme.muted,textTransform:'uppercase'},
});
const styles=StyleSheet.create({
  text:{fontFamily:theme.font,fontSize:15,color:theme.text},
  button:{minHeight:48,borderRadius:15,paddingVertical:12,paddingHorizontal:18,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},
  fieldWrap:{gap:7,marginBottom:15},label:{fontFamily:theme.semibold,fontSize:12,color:theme.text},
  input:{backgroundColor:theme.surface,borderWidth:1,borderColor:theme.border,borderRadius:14,paddingHorizontal:15,paddingVertical:13,fontFamily:theme.font,fontSize:15,color:theme.text,minHeight:49},
  screen:{flex:1,backgroundColor:theme.background},screenContent:{width:'100%',maxWidth:1040,alignSelf:'center',padding:20,paddingBottom:24},
  empty:{paddingVertical:35,paddingHorizontal:18,alignItems:'center',gap:13},emptyIcon:{width:62,height:62,borderRadius:24,backgroundColor:theme.brandLight,alignItems:'center',justifyContent:'center',marginBottom:3},emptyTitle:{fontFamily:theme.bold,fontSize:18,textAlign:'center'},emptyBody:{maxWidth:330,fontSize:13,lineHeight:22,color:theme.muted,textAlign:'center',marginBottom:7},
});
