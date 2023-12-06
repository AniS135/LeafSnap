from fastapi import FastAPI,UploadFile,File
import uvicorn
from io import BytesIO
from PIL import Image
import numpy as np
import keras
import tensorflow as tf
from tensorflow.keras import layers
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import base64
import json

app = FastAPI()
origins = [
    "*"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
batch_size = 100
img_height = 256
img_width = 256

with open('remedies.json', 'r') as openfile:
    remedies = json.load(openfile)


resize_and_rescale=tf.keras.Sequential([
    layers.experimental.preprocessing.Resizing(img_height,img_width),
    layers.experimental.preprocessing.Rescaling(1.0/255)
])
data_augmentation=tf.keras.Sequential([
    layers.experimental.preprocessing.RandomFlip("horizontal_and_vertical"),
    layers.experimental.preprocessing.RandomRotation(0.2),
])
## Defining Cnn
input_shape=(batch_size,img_height,img_width,3)
n_classes=38
MyCnn = tf.keras.models.Sequential([
    resize_and_rescale,
    data_augmentation,
    layers.Conv2D(32, kernel_size=(3, 3), padding="same", activation="relu", input_shape=input_shape),
    layers.MaxPooling2D(2, 2),

    layers.Conv2D(64, kernel_size=(3, 3), padding="same", activation="relu"),
    layers.MaxPooling2D(2, 2),

    layers.Conv2D(64, kernel_size=(3, 3), padding="same", activation="relu"),
    layers.MaxPooling2D(2, 2),

    layers.Conv2D(64, (3, 3), padding="same", activation="relu"),
    layers.MaxPooling2D(2, 2),

    layers.Conv2D(64, (3, 3), padding="same", activation="relu"),
    layers.MaxPooling2D(2, 2),

    layers.Flatten(),
    layers.Dense(64, activation="relu"),
    layers.Dropout(0.2),
    layers.Dense(128, activation="relu"),

    layers.Dense(n_classes, activation="softmax"),
])

MyCnn.build(input_shape=input_shape)
from keras import backend as K

def recall_m(y_true, y_pred):
    true_positives = K.sum(K.round(K.clip(y_true * y_pred, 0, 1)))
    possible_positives = K.sum(K.round(K.clip(y_true, 0, 1)))
    recall = true_positives / (possible_positives + K.epsilon())
    return recall

def precision_m(y_true, y_pred):
    true_positives = K.sum(K.round(K.clip(y_true * y_pred, 0, 1)))
    predicted_positives = K.sum(K.round(K.clip(y_pred, 0, 1)))
    precision = true_positives / (predicted_positives + K.epsilon())
    return precision

def f1_m(y_true, y_pred):
    precision = precision_m(y_true, y_pred)
    recall = recall_m(y_true, y_pred)
    return 2*((precision*recall)/(precision+recall+K.epsilon()))
MyCnn.compile(
    optimizer='adam',
    loss=tf.keras.losses.SparseCategoricalCrossentropy(from_logits=False),
    metrics=['accuracy',precision_m, recall_m, f1_m]
)
MyCnn.load_weights("PlantDiseaseDetectionCnn.h5")


CLASS_NAMES=['Apple___Apple_scab',
 'Apple___Black_rot',
 'Apple___Cedar_apple_rust',
 'Apple___healthy',
 'Blueberry___healthy',
 'Cherry_(including_sour)___Powdery_mildew',
 'Cherry_(including_sour)___healthy',
 'Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot',
 'Corn_(maize)___Common_rust_',
 'Corn_(maize)___Northern_Leaf_Blight',
 'Corn_(maize)___healthy',
 'Grape___Black_rot',
 'Grape___Esca_(Black_Measles)',
 'Grape___Leaf_blight_(Isariopsis_Leaf_Spot)',
 'Grape___healthy',
 'Orange___Haunglongbing_(Citrus_greening)',
 'Peach___Bacterial_spot',
 'Peach___healthy',
 'Pepper,_bell___Bacterial_spot',
 'Pepper,_bell___healthy',
 'Potato___Early_blight',
 'Potato___Late_blight',
 'Potato___healthy',
 'Raspberry___healthy',
 'Soybean___healthy',
 'Squash___Powdery_mildew',
 'Strawberry___Leaf_scorch',
 'Strawberry___healthy',
 'Tomato___Bacterial_spot',
 'Tomato___Early_blight',
 'Tomato___Late_blight',
 'Tomato___Leaf_Mold',
 'Tomato___Septoria_leaf_spot',
 'Tomato___Spider_mites Two-spotted_spider_mite',
 'Tomato___Target_Spot',
 'Tomato___Tomato_Yellow_Leaf_Curl_Virus',
 'Tomato___Tomato_mosaic_virus',
 'Tomato___healthy']

@app.get("/ping")
async def ping():
    return "Hello , I am alive"

def read_file_as_image(data)->np.ndarray:
    image=np.array(Image.open(BytesIO(data)))
    return image

def read_base64_as_image(base64_string: str) -> np.ndarray:
    decoded_data = base64.b64decode(base64_string)
    image = np.array(Image.open(BytesIO(decoded_data)))
    return image


@app.post("/predict")
async def predict(
    file:UploadFile=File(...)
):
    image = read_file_as_image(await file.read())
    resized_image = np.array(Image.fromarray(image).resize((256, 256)))
    # Add batch dimension
    img_batch = np.expand_dims(resized_image, 0)
    # img_batch=np.expand_dims(image,0)
    predictions=MyCnn.predict(img_batch)
    predicted_class=CLASS_NAMES[np.argmax(predictions[0])]
    confidence=np.max(predictions[0])
    return {
        "class":predicted_class,
        "confidence":float(confidence)
    }

class PredictionRequest(BaseModel):
    file: str

@app.post("/predictStringFile")
async def predictStringFile(request_data: PredictionRequest):
    # print(request_data.file)
    image = read_base64_as_image(request_data.file)
    resized_image = np.array(Image.fromarray(image).resize((1024, 1024)))
    # Add batch dimension
    img_batch = np.expand_dims(resized_image, 0)
    # img_batch=np.expand_dims(image,0)
    predictions=MyCnn.predict(img_batch)
    predicted_class=CLASS_NAMES[np.argmax(predictions[0])]
    confidence=np.max(predictions[0])
    return {
        "class":predicted_class,
        "confidence":float(confidence),
        "remedy":remedies[predicted_class]
    }

@app.get("/predict")
async def predictGet():
    return {
        "class":"Apple",
        "confidence":"99.9"
    }

@app.post("/demo")
async def demo(request_data: PredictionRequest):
    print(request_data.file)
    return {
        "class":"Apple",
        "confidence":"99.9"
    }
    

if __name__ == "__main__":
    uvicorn.run(app,host='localhost',port=8000)