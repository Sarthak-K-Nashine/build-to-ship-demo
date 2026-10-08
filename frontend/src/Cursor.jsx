import React, { useEffect, useState } from 'react';
import { motion, useSpring, useMotionValue } from 'framer-motion';

export default function Cursor() {
  const [isVisible, setIsVisible] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  
  // Fast inner dot
  const cursorX = useMotionValue(-100);
  const cursorY = useMotionValue(-100);
  
  // Slower outer ring
  const cursorXOuter = useMotionValue(-100);
  const cursorYOuter = useMotionValue(-100);

  const springConfigInner = { damping: 40, stiffness: 600, mass: 0.1 };
  const springConfigOuter = { damping: 25, stiffness: 200, mass: 0.6 };

  const smoothX = useSpring(cursorX, springConfigInner);
  const smoothY = useSpring(cursorY, springConfigInner);
  
  const smoothXOuter = useSpring(cursorXOuter, springConfigOuter);
  const smoothYOuter = useSpring(cursorYOuter, springConfigOuter);

  useEffect(() => {
    const moveCursor = (e) => {
      cursorX.set(e.clientX);
      cursorY.set(e.clientY);
      cursorXOuter.set(e.clientX - 16);
      cursorYOuter.set(e.clientY - 16);
      if (!isVisible) setIsVisible(true);
    };
    
    const handleMouseLeave = () => setIsVisible(false);

    const handleMouseOver = (e) => {
      const target = e.target;
      // Check if hovering over interactive elements
      if (
        target.tagName.toLowerCase() === 'button' ||
        target.tagName.toLowerCase() === 'a' ||
        target.tagName.toLowerCase() === 'input' ||
        target.tagName.toLowerCase() === 'textarea' ||
        target.closest('button') ||
        target.closest('a')
      ) {
        setIsHovering(true);
      } else {
        setIsHovering(false);
      }
    };

    window.addEventListener('mousemove', moveCursor);
    document.body.addEventListener('mouseleave', handleMouseLeave);
    document.body.addEventListener('mouseover', handleMouseOver);
    
    return () => {
      window.removeEventListener('mousemove', moveCursor);
      document.body.removeEventListener('mouseleave', handleMouseLeave);
      document.body.removeEventListener('mouseover', handleMouseOver);
    };
  }, [cursorX, cursorY, cursorXOuter, cursorYOuter, isVisible]);

  if (!isVisible) return null;

  return (
    <>
      <motion.div
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          x: smoothX,
          y: smoothY,
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          backgroundColor: '#2557d6',
          pointerEvents: 'none',
          zIndex: 10000,
          translateX: '-50%',
          translateY: '-50%',
        }}
        animate={{
          scale: isHovering ? 0 : 1,
          opacity: isHovering ? 0 : 1
        }}
        transition={{ duration: 0.15 }}
      />
      <motion.div
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          x: smoothXOuter,
          y: smoothYOuter,
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          border: '1.5px solid rgba(37, 87, 214, 0.4)',
          backgroundColor: isHovering ? 'rgba(37, 87, 214, 0.15)' : 'transparent',
          backdropFilter: isHovering ? 'blur(2px)' : 'none',
          pointerEvents: 'none',
          zIndex: 9999,
          boxShadow: isHovering ? '0 0 15px rgba(37, 87, 214, 0.3)' : 'none'
        }}
        animate={{
          scale: isHovering ? 1.5 : 1,
          borderWidth: isHovering ? '0px' : '1.5px',
        }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      />
    </>
  );
}
