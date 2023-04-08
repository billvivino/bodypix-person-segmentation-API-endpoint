const express = require('express');
const { createCanvas, loadImage, createImageData, Image } = require('canvas');
const fs = require('fs');
const inkjet = require('inkjet');
const tfjs = require('@tensorflow/tfjs-node');
const { loadGraphModel } = require('@tensorflow/tfjs-converter');
const bodyPix = require('@tensorflow-models/body-pix');
const Jimp = require('jimp');
const multer = require('multer');
const cors = require('cors');
const app = express();
const port = 3000;
var img;
const upload = multer({ 
  dest: 'input/'
});

// app.use(express.json());
// enable CORS
app.use(cors());

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});

app.post('/process-image', upload.single('Image'), async (req, res) => {
  try {
    //get the uploaded image file
    const imageFile = req.file;;
    if (!imageFile) {
      res.status(400).send('No image file uploaded');
      return;
    }
    const { filename } = req.file;

    var srcimagefile = `input/${filename}`;
    var srcimg = fs.readFileSync(srcimagefile);

    inkjet.decode(srcimg, function(err, data){
        if(err) throw err;
        console.log("Image loaded.");
        var img = convImg(data); //this function is provided below
        //console.log(img);
        loadAndPredict(img).catch(e => {console.error(e)}) //this function is provided below
    });
  } catch (err) {
    console.error(err);
  }


  function convImg(data){
    imgD = createImageData(new Uint8ClampedArray(data.data), data.width, data.height);
    img = new Image();
    img.src = srcimagefile;
    const canvas = createCanvas(data.width,data.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img,0,0,data.width,data.height);
    return tfjs.browser.fromPixels(canvas);
  }

  async function loadAndPredict(data) {
    console.log(data)
    console.log("loading architecture");
    const net = await bodyPix.load();
    console.log()
    console.log("segmenting person");
    const segmentation = await net.segmentPerson(data, {
      flipHorizontal: false,
      internalResolution: 'high',
      segmentationThreshold: 0.1
    });
    console.log(segmentation);
    // what you do at this point with the segmentation is up to you
    // save segmentation as png file
    console.log("saving segmentation");
    // by setting maskBackground to false, the maskImage that is generated will be opaque where there is a person and transparent where there is a background.
    
    // const sizeOf = require('image-size');
    // load the image to get its size
    // const dimensions = sizeOf('image.jpg');
    const imageWidth =  img.width;
    const imageHeight =  img.height;

    // create a new canvas with the same dimensions as the image
    const canvas = createCanvas(imageWidth, imageHeight);
    const context = canvas.getContext('2d');

    // load the image into the canvas
    const image = await loadImage('image.jpg');
    context.drawImage(img, 0, 0);

    // get the pixel data of the canvas
    const imageData = context.getImageData(0, 0, imageWidth, imageHeight);
    const pixelData = imageData.data;
    const maskData = segmentation.data;

    // loop through the pixel data and apply the mask
    for (let i = 0; i < pixelData.length; i += 4) {
      // const isTransparent = pixelData[i + 3] === 0; // check if alpha is 0
      const shouldBeTransparent = maskData[i / 4] === 0; // get the mask value for this pixel
      
      if (shouldBeTransparent) {
        pixelData[i + 3] = 0; // set alpha to 0
      }
    }

    // put the modified pixel data back into the canvas
    context.putImageData(imageData, 0, 0);

    // export the canvas as an image
    const outputBuffer = canvas.toBuffer();

    // rotate the output image using Jimp
    Jimp.read(outputBuffer, (err, image) => {
      if (err) {
        res.status(500).send({ message: 'Internal Server Error' });
      } else {
        // image.rotate(270).write('output.jpg');
        image.write('output.png');
        // Save the image as a buffer
        image.getBuffer(Jimp.MIME_PNG, (err, buffer) => {
          if (err) {
            console.log(err);
            res.status(500).send({ message: 'Internal Server Error' });
          } else {
            // Send the buffer as a response
            res.set('Content-Type', 'image/png');
            res.set('Content-Disposition', 'attachment; filename=output.png');
            res.set('Content-Length', buffer.length);
            res.end(buffer);
          }
        });
      }
    });
    console.log('The file has been saved!');
    // write the output buffer to a file
    // fs.writeFile('output.jpg', outputBuffer, (err) => {
    //   if (err) throw err;
      
    // });
    
    // Convert the object to a JSON string
    const jsonString = JSON.stringify(segmentation.data);

    // Write the JSON string to a file
    fs.writeFileSync('segmentationData.json', jsonString);
      
    // send the modified image as the response
    // res.set('Content-Type', 'image/jpg');
    // res.set('Content-Length', outputBuffer.length);
    // res.send(outputBuffer);
    console.log("done");
  }
});

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.listen(3000, () => {
  console.log('Server listening on port 3000');
});