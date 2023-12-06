import React, { useState } from 'react';
import {
  SafeAreaView,
  Image,
  StatusBar,
  StyleSheet,
  Text,
  Platform,
  Dimensions,
  useColorScheme,
  View,
  TouchableOpacity,
  ImageBackground,
  NativeModules
} from 'react-native';
import axios from 'axios';
import Config from 'react-native-config';
import RNFS from 'react-native-fs';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { Colors } from 'react-native/Libraries/NewAppScreen';
import PermissionsService, { isIOS } from './Permissions';

axios.interceptors.request.use(
  async config => {
    let request = config;

    request.headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    request.url = configureUrl(config.url);
    return request;
  },
  error => error,
);

export const { height, width } = Dimensions.get('window');

export const configureUrl = url => {
  let authUrl = url;
  if (url && url[url.length - 1] === '/') {
    authUrl = url.substring(0, url.length - 1);
  }
  return authUrl;
};

export const fonts = {
  Bold: { fontFamily: 'Roboto-Bold' },
};

const options = {
  mediaType: 'photo',
  quality: 1,
  width: 256,
  height: 256,
  includeBase64: true,
};

const App = () => {
  const [result, setResult] = useState('');
  const [label, setLabel] = useState('');
  const isDarkMode = useColorScheme() === 'dark';
  const [image, setImage] = useState('');
  const [remedy, setRemedy] = useState('');
  const backgroundStyle = {
    backgroundColor: isDarkMode ? Colors.darker : Colors.lighter,
  };

  const getPredication = async params => {
    return new Promise(async (resolve, reject) => {
      // var bodyFormData = new FormData();
      // bodyFormData.append('file', params.file, 'file.jpg');
      const url = `https://cc17-2401-4900-5d8d-84c1-79aa-f3a0-2258-d570.ngrok-free.app/predictStringFile`;
      console.log(url);

      const data = {
        file: params.fileContent,
      };

      // const response = await axios.post('http://10.0.2.2:8000/predictStringFile', data);

      return axios
        .post(url, data)
        .then(response => {
          console.log(response.data);
          resolve(response);
        })
        .catch(error => {
          setLabel('Failed to predicting.');
          console.log(error);
          reject('err', error);
        });
    });
  };

  const handleImageUpload = async (fileContent) => {
    try {
      const data = {
        file: fileContent,
      };

      const response = await axios.post('http://10.0.2.2:8000/predictStringFile', data);

      console.log('Upload success:', response.data);
    } catch (error) {
      console.error('Upload error:', error);
    }
  };


  const manageCamera = async type => {
    // try {
    //   if(type === 'Camera' && await PermissionsService.hasCameraPermission()) {
    //     openCamera();
    //   } else if(type === 'Photo' && await PermissionsService.hasPhotoPermission()){
    //     openLibrary();
    //   } else {
    //     return [];
    //   }
    // } catch (err) {
    //   console.log(err);
    // }

    try {
      if (!(await PermissionsService.hasCameraPermission())) {
        return [];
      } else {
        if (type === 'Camera') {
          openCamera();
        } else {
          openLibrary();
        }
      }
    } catch (err) {
      console.log(err);
    }
  };

  const openCamera = async () => {
    launchCamera(options, async response => {
      if (response.didCancel) {
        console.log('User cancelled image picker');
      } else if (response.error) {
        console.log('ImagePicker Error: ', response.error);
      } else if (response.customButton) {
        console.log('User tapped custom button: ', response.customButton);
      } else {
        const uri = response?.assets[0]?.uri;
        const path = Platform.OS !== 'ios' ? uri : 'file://' + uri;
        getResult(path, response);
      }
    });
  };

  const clearOutput = () => {
    setResult('');
    setImage('');
    setRemedy('');
  };

  const getResult = async (path, response) => {
    setImage(path);
    setLabel('Predicting...');
    setResult('');
    setRemedy('');

    const params = {
      fileContent: response.assets[0].base64
    }

    // const params = {
    //   uri: path,
    //   name: response.assets[0].fileName,
    //   type: response.assets[0].type
    // };

    const fileContent = response.assets[0].base64;

    // try {
    const res = await getPredication(params);
    // const res = await handleImageUpload(fileContent);
    if (res?.data?.class) {
      setLabel(res.data.class);
      setResult(res.data.confidence);
      setRemedy(res.data.remedy);
    } else {
      setLabel('Failed to predict');
    }

    // } catch (error) {
    //   console.error(error.message);
    // }

  };

  const openLibrary = async () => {
    launchImageLibrary(options, async response => {
      if (response.didCancel) {
        console.log('User cancelled image picker');
      } else if (response.error) {
        console.log('ImagePicker Error: ', response.error);
      } else if (response.customButton) {
        console.log('User tapped custom button: ', response.customButton);
      } else {
        const uri = response.assets[0].uri;
        const path = Platform.OS !== 'ios' ? uri : 'file://' + uri;
        getResult(path, response);
      }
    });
  };

  return (
    <View style={[backgroundStyle, styles.outer]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <ImageBackground
        blurRadius={10}
        source={{ uri: 'background' }}
        style={{ height: height, width: width }}
      />
      <Text style={styles.title}>{'LeafSnap'}</Text>
      <TouchableOpacity onPress={clearOutput} style={styles.clearStyle}>
        <Image source={{ uri: 'clean' }} style={styles.clearImage} />
      </TouchableOpacity>
      {(image?.length && (
        <Image source={{ uri: image }} style={styles.imageStyle} />
      )) ||
        null}
      {(result && label && (
        <View style={styles.mainOuter}>
          <Text style={[styles.space, styles.labelText]}>
            {'Label: '}
            <Text style={styles.resultText}>{label}</Text>
          </Text>
          <Text style={[styles.space, styles.labelText]}>
            {'Confidence: '}
            <Text style={styles.resultText}>
              {parseFloat(result * 100).toFixed(2) + '%'}
            </Text>
          </Text>
          <Text style={[styles.space, styles.labelText]}>
            {'Remedy: '}
            <Text style={styles.resultText}>{remedy}</Text>
          </Text>
        </View>
      )) ||
        (image && <Text style={styles.emptyText}>{label}</Text>) || (
          <Text style={styles.emptyText}>
            Use below buttons to select a picture of a plant leaf.
          </Text>
        )}
      <View style={styles.btn}>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => manageCamera('Camera')}
          style={styles.btnStyle}>
          <Image source={{ uri: 'camera' }} style={styles.imageIcon} />
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => manageCamera('Photo')}
          style={styles.btnStyle}>
          <Image source={{ uri: 'gallery' }} style={styles.imageIcon} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  title: {
    alignSelf: 'center',
    position: 'absolute',
    top: (isIOS && 35) || 10,
    fontSize: 30,
    ...fonts.Bold,
    color: '#FFF',
  },
  clearImage: { height: 40, width: 40, tintColor: '#FFF' },
  mainOuter: {
    flexDirection: 'col',
    justifyContent: 'space-between',
    position: 'absolute',
    top: height / 1.6,
    alignSelf: 'center',
  },
  outer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btn: {
    position: 'absolute',
    bottom: 40,
    justifyContent: 'space-between',
    flexDirection: 'row',
  },
  btnStyle: {
    backgroundColor: '#FFF',
    opacity: 0.8,
    marginHorizontal: 30,
    padding: 20,
    borderRadius: 20,
  },
  imageStyle: {
    marginBottom: 10,
    width: width / 1.5,
    height: width / 1.5,
    borderRadius: 20,
    position: 'absolute',
    borderWidth: 0.3,
    borderColor: '#FFF',
    top: height / 4.5,
  },
  clearStyle: {
    position: 'absolute',
    top: 100,
    right: 30,
    tintColor: '#000',
    zIndex: 10,
  },
  space: { marginVertical: 5, marginHorizontal: 5 },
  labelText: { color: '#FFF', fontSize: 20, ...fonts.Bold },
  resultText: { fontSize: 18, ...fonts.Bold },
  imageIcon: { height: 40, width: 40, tintColor: '#000' },
  emptyText: {
    position: 'absolute',
    top: height / 1.6,
    alignSelf: 'center',
    color: '#FFF',
    fontSize: 20,
    maxWidth: '70%',
    ...fonts.Bold,
  },
});

export default App;
