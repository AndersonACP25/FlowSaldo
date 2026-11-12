import React, {useState} from 'react';
import {Image, Pressable, StyleSheet} from 'react-native';
import {palette, styles as s} from './theme';

// Metro resolves bundled images through static require calls.
/* eslint-disable @typescript-eslint/no-require-imports */
const icons={
 eye:require('../assets/icons/eye.png'),
 'eye-off':require('../assets/icons/eye-off.png'),
 logout:require('../assets/icons/logout.png'),
 edit:require('../assets/icons/edit.png'),
 copy:require('../assets/icons/copy.png'),
 trash:require('../assets/icons/trash.png'),
 calendar:require('../assets/icons/calendar.png'),
};
/* eslint-enable @typescript-eslint/no-require-imports */

export function IconButton({icon,label,onPress,disabled=false,danger=false}:{
 icon:keyof typeof icons;label:string;onPress:()=>void;disabled?:boolean;danger?:boolean
}) {
 const [focused,setFocused]=useState(false);
 return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress}
  onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)}
  style={({pressed})=>[styles.button,focused&&styles.focused,pressed&&s.selected,disabled&&s.disabled]}>
  <Image source={icons[icon]} accessible={false} style={[styles.icon,danger&&styles.danger]}/>
 </Pressable>;
}

const styles=StyleSheet.create({
 button:{alignSelf:'flex-start',minWidth:44,minHeight:44,paddingHorizontal:10,borderRadius:12,borderWidth:1,borderColor:palette.border,
  backgroundColor:palette.raised,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},
 focused:{borderColor:palette.primary},
 icon:{width:21,height:21,tintColor:palette.ink},
 danger:{tintColor:palette.danger},
});
