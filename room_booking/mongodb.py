from pymongo import MongoClient

# MongoDB connection URL
client = MongoClient("mongodb+srv://faruk:VxSn7PbRHtlkINAg@grfs-booking-django.0pc3wuc.mongodb.net/")  # Replace with your MongoDB URL
db = client["GRFS-Booking-Django"]  # Database name