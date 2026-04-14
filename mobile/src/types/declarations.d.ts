// Declare svg handling for typescript
declare module '*.svg' {
  
  import { SvgProps } from 'react-native-svg';
  const content: React.FC<SvgProps>;
  export default content;
}

// Ensure the NativeWind types are picked up
/// <reference types="nativewind/types" />
