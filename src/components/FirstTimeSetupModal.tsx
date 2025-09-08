import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  Modal,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

interface FirstTimeSetupModalProps {
  visible: boolean;
  onComplete: (userData: { name: string; pin?: string; email?: string }) => void;
}

export const FirstTimeSetupModal: React.FC<FirstTimeSetupModalProps> = ({
  visible,
  onComplete,
}) => {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [email, setEmail] = useState('');

  const handleNextStep = () => {
    if (step === 1) {
      if (!name.trim()) {
        Alert.alert('Name Required', 'Please enter your name to continue.');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (pin && pin !== confirmPin) {
        Alert.alert('PIN Mismatch', 'PINs do not match. Please try again.');
        return;
      }
      if (pin && pin.length !== 4) {
        Alert.alert('Invalid PIN', 'PIN must be exactly 4 digits.');
        return;
      }
      setStep(3);
    } else if (step === 3) {
      handleComplete();
    }
  };

  const handleSkipStep = () => {
    if (step === 2) {
      setPin('');
      setConfirmPin('');
      setStep(3);
    } else if (step === 3) {
      setEmail('');
      handleComplete();
    }
  };

  const handleComplete = () => {
    const userData = {
      name: name.trim(),
      ...(pin && { pin }),
      ...(email && { email: email.trim() })
    };
    onComplete(userData);
  };

  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Welcome!</Text>
      <Text style={styles.stepSubtitle}>Let's get you set up</Text>
      <Text style={styles.stepDescription}>
        First, what should we call you?
      </Text>
      
      <TextInput
        style={styles.input}
        placeholder="Enter your name"
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
        autoFocus
      />
      
      <TouchableOpacity 
        style={[styles.primaryButton, !name.trim() && styles.disabledButton]}
        onPress={handleNextStep}
        disabled={!name.trim()}
      >
        <Text style={styles.primaryButtonText}>Continue</Text>
      </TouchableOpacity>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Security Setup</Text>
      <Text style={styles.stepDescription}>
        Set up a 4-digit PIN to secure your app (optional)
      </Text>
      
      <TextInput
        style={styles.input}
        placeholder="Enter 4-digit PIN"
        value={pin}
        onChangeText={(text) => setPin(text.replace(/\D/g, '').slice(0, 4))}
        keyboardType="numeric"
        secureTextEntry
        maxLength={4}
      />
      
      {pin.length > 0 && (
        <TextInput
          style={styles.input}
          placeholder="Confirm PIN"
          value={confirmPin}
          onChangeText={(text) => setConfirmPin(text.replace(/\D/g, '').slice(0, 4))}
          keyboardType="numeric"
          secureTextEntry
          maxLength={4}
        />
      )}
      
      <TouchableOpacity 
        style={styles.primaryButton}
        onPress={handleNextStep}
      >
        <Text style={styles.primaryButtonText}>
          {pin ? 'Continue' : 'Skip for now'}
        </Text>
      </TouchableOpacity>
      
      {pin.length > 0 && (
        <TouchableOpacity 
          style={styles.secondaryButton}
          onPress={handleSkipStep}
        >
          <Text style={styles.secondaryButtonText}>Skip PIN setup</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Email Notifications</Text>
      <Text style={styles.stepDescription}>
        Add your email to receive financial notifications (optional)
      </Text>
      
      <TextInput
        style={styles.input}
        placeholder="Enter your email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      
      <TouchableOpacity 
        style={styles.primaryButton}
        onPress={handleNextStep}
      >
        <Text style={styles.primaryButtonText}>Get Started</Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={styles.secondaryButton}
        onPress={handleSkipStep}
      >
        <Text style={styles.secondaryButtonText}>Skip email setup</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide">
      <SafeAreaView style={styles.safeContainer}>
        <LinearGradient colors={['#8B5CF6', '#A855F7']} style={styles.container}>
          <KeyboardAvoidingView 
            style={styles.keyboardContainer}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
          <ScrollView contentContainerStyle={styles.scrollContainer}>
            <View style={styles.progressContainer}>
              {[1, 2, 3].map((stepNumber) => (
                <View 
                  key={stepNumber}
                  style={[
                    styles.progressDot, 
                    step >= stepNumber && styles.progressDotActive
                  ]} 
                />
              ))}
            </View>
            
            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}
            {step === 3 && renderStep3()}
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 40,
  },
  progressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginHorizontal: 6,
  },
  progressDotActive: {
    backgroundColor: '#FFFFFF',
  },
  stepContainer: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
  },
  stepTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 18,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 20,
  },
  stepDescription: {
    fontSize: 16,
    color: '#4B5563',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 22,
  },
  input: {
    width: '100%',
    height: 50,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    marginBottom: 20,
  },
  primaryButton: {
    width: '100%',
    height: 50,
    backgroundColor: '#8B5CF6',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  disabledButton: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    width: '100%',
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#6B7280',
    fontSize: 16,
  },
});