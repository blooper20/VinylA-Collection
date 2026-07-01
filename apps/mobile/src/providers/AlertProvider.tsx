import React, { createContext, useContext, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '@vinyla/ui';

interface AlertContextType {
  showAlert: (title: string, message?: string, onOk?: () => void) => void;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export const useAlert = () => {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlert must be used within an AlertProvider');
  }
  return context;
};

export const CustomAlert = ({
  visible,
  title,
  message,
  onClose,
}: {
  visible: boolean;
  title: string;
  message?: string;
  onClose: () => void;
}) => {
  const { themeColors, glassIntensity } = useTheme();

  if (!visible) return null;

  return (
    <View style={[StyleSheet.absoluteFill, styles.container, { zIndex: 9999 }]}>
      <BlurView intensity={glassIntensity || 30} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={[styles.alertBox, { backgroundColor: 'rgba(20,20,20,0.8)', borderColor: themeColors.border }]}>
        <Text style={[styles.title, { color: themeColors.textPrimary }]}>{title}</Text>
        {!!message && <Text style={[styles.message, { color: themeColors.textSecondary }]}>{message}</Text>}
        <TouchableOpacity 
          style={[styles.button, { backgroundColor: themeColors.accent }]}
          onPress={onClose}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>OK</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export const AlertProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [visible, setVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState<string | undefined>('');
  const [onOkCallback, setOnOkCallback] = useState<(() => void) | undefined>(undefined);

  const showAlert = (title: string, message?: string, onOk?: () => void) => {
    setAlertTitle(title);
    setAlertMessage(message);
    setOnOkCallback(() => onOk);
    setVisible(true);
  };

  const handleClose = () => {
    setVisible(false);
    if (onOkCallback) {
      onOkCallback();
    }
  };

  return (
    <AlertContext.Provider value={{ showAlert }}>
      {children}
      <Modal visible={visible} animationType="fade" transparent statusBarTranslucent>
        <CustomAlert 
          visible={visible} 
          title={alertTitle} 
          message={alertMessage} 
          onClose={handleClose} 
        />
      </Modal>
    </AlertContext.Provider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  alertBox: {
    width: '75%',
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#d4af37',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  title: {
    fontFamily: 'Bodoni',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  button: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
  },
  buttonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
